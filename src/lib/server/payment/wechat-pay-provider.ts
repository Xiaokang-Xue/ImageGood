import "server-only";
import {
  buildWechatAuthorizationHeader,
  buildWechatNotifySignatureMessage,
  buildWechatRequestSignatureMessage,
  createNonce,
  createTimestamp,
  decryptWechatResource,
  readPemFile,
  signWechatPayMessage,
  verifyWechatPaySignature
} from "@/lib/server/payment/wechat-crypto";
import type { CreateNativePaymentInput, CreateNativePaymentResult, PaymentProvider, WechatPaymentNotification } from "@/lib/server/payment/payment-provider";

const WECHAT_PAY_BASE_URL = "https://api.mch.weixin.qq.com";
const NATIVE_PATH = "/v3/pay/transactions/native";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`微信支付配置缺失：${name}`);
  }
  return value;
}

export class WechatPayProvider implements PaymentProvider {
  async createPayment(input: CreateNativePaymentInput): Promise<CreateNativePaymentResult> {
    const appid = requireEnv("WECHAT_PAY_APPID");
    const mchid = requireEnv("WECHAT_PAY_MCH_ID");
    const serialNo = requireEnv("WECHAT_PAY_MERCHANT_SERIAL_NO");
    const privateKey = await readPemFile(requireEnv("WECHAT_PAY_PRIVATE_KEY_PATH"));
    const body = JSON.stringify({
      appid,
      mchid,
      description: input.description,
      out_trade_no: input.order.outTradeNo,
      notify_url: input.notifyUrl,
      amount: {
        total: input.order.amountCents,
        currency: "CNY"
      }
    });
    const timestamp = createTimestamp();
    const nonce = createNonce();
    const signatureMessage = buildWechatRequestSignatureMessage({
      method: "POST",
      canonicalUrl: NATIVE_PATH,
      timestamp,
      nonce,
      body
    });
    const authorization = buildWechatAuthorizationHeader({
      mchId: mchid,
      serialNo,
      nonce,
      timestamp,
      signature: signWechatPayMessage(privateKey, signatureMessage)
    });

    const response = await fetch(`${WECHAT_PAY_BASE_URL}${NATIVE_PATH}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "imagegood/1.0"
      },
      body
    });

    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      code_url?: string;
      message?: string;
    } | null;
    if (!response.ok || !payload?.code_url) {
      throw new Error(payload?.message || payload?.code || `微信支付下单失败：${response.status}`);
    }

    return {
      provider: "wechat",
      paymentMethod: "native",
      codeUrl: payload.code_url,
      raw: payload
    };
  }
}

export async function parseWechatPaymentNotify(rawBody: string, headers: Headers): Promise<WechatPaymentNotification> {
  const timestamp = headers.get("Wechatpay-Timestamp") || "";
  const nonce = headers.get("Wechatpay-Nonce") || "";
  const signature = headers.get("Wechatpay-Signature") || "";
  const serial = headers.get("Wechatpay-Serial") || "";

  if (!timestamp || !nonce || !signature || !serial) {
    throw new Error("微信支付回调请求头不完整");
  }

  const expectedSerial = process.env.WECHAT_PAY_PLATFORM_CERT_SERIAL_NO;
  if (expectedSerial && expectedSerial !== serial) {
    throw new Error("微信支付回调平台证书序列号不匹配");
  }

  const platformCertificate = await readPemFile(requireEnv("WECHAT_PAY_PLATFORM_CERT_PATH"));
  const message = buildWechatNotifySignatureMessage({ timestamp, nonce, rawBody });
  if (!verifyWechatPaySignature(platformCertificate, message, signature)) {
    throw new Error("微信支付回调验签失败");
  }

  const body = JSON.parse(rawBody) as {
    resource?: {
      associated_data?: string;
      nonce?: string;
      ciphertext?: string;
    };
  };

  if (!body.resource?.nonce || !body.resource.ciphertext) {
    throw new Error("微信支付回调资源为空");
  }

  const decrypted = decryptWechatResource({
    apiV3Key: requireEnv("WECHAT_PAY_API_V3_KEY"),
    nonce: body.resource.nonce,
    associatedData: body.resource.associated_data,
    ciphertext: body.resource.ciphertext
  });

  return JSON.parse(decrypted) as WechatPaymentNotification;
}
