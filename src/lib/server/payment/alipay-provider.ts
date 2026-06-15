import "server-only";
import { createSign, createVerify } from "crypto";
import type {
  CreateNativePaymentInput,
  CreateNativePaymentResult,
  PaymentProvider
} from "@/lib/server/payment/payment-provider";

const DEFAULT_ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";
const DEFAULT_SIGN_TYPE = "RSA2";

export interface AlipayNotification {
  app_id?: string;
  out_trade_no: string;
  trade_no?: string;
  trade_status: string;
  total_amount: string;
  raw: Record<string, string>;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`支付宝配置缺失：${name}`);
  }
  return value;
}

function normalizePem(value: string, type: "private" | "public") {
  const trimmed = value.trim();
  if (trimmed.includes("-----BEGIN")) {
    return trimmed.replace(/\\n/g, "\n");
  }

  const header = type === "private" ? "-----BEGIN PRIVATE KEY-----" : "-----BEGIN PUBLIC KEY-----";
  const footer = type === "private" ? "-----END PRIVATE KEY-----" : "-----END PUBLIC KEY-----";
  const lines = trimmed.replace(/\s+/g, "").match(/.{1,64}/g) || [];
  return [header, ...lines, footer].join("\n");
}

function alipayTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds())
  ].join("");
}

function centsToAlipayAmount(amountCents: number) {
  return `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, "0")}`;
}

export function alipayAmountToCents(amount: string) {
  const normalized = String(amount || "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("支付宝回调金额格式不正确");
  }

  const [yuan, cents = ""] = normalized.split(".");
  return Number(yuan) * 100 + Number(cents.padEnd(2, "0").slice(0, 2));
}

function buildSignContent(params: Record<string, string>, options?: { excludeSignType?: boolean }) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && (!options?.excludeSignType || key !== "sign_type"))
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signAlipayParams(params: Record<string, string>, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(buildSignContent(params), "utf-8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

function verifyAlipayParams(params: Record<string, string>, publicKey: string) {
  const signature = params.sign;
  if (!signature) return false;

  const verifier = createVerify("RSA-SHA256");
  verifier.update(buildSignContent(params, { excludeSignType: true }), "utf-8");
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

function paramsFromFormBody(rawBody: string) {
  const searchParams = new URLSearchParams(rawBody);
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export class AlipayProvider implements PaymentProvider {
  async createPayment(input: CreateNativePaymentInput): Promise<CreateNativePaymentResult> {
    const appId = requireEnv("ALIPAY_APP_ID");
    const privateKey = normalizePem(requireEnv("ALIPAY_APP_PRIVATE_KEY"), "private");
    const gateway = process.env.ALIPAY_GATEWAY || DEFAULT_ALIPAY_GATEWAY;
    const signType = process.env.ALIPAY_SIGN_TYPE || DEFAULT_SIGN_TYPE;

    if (signType !== "RSA2") {
      throw new Error("当前仅支持支付宝 RSA2 签名");
    }

    const bizContent = JSON.stringify({
      out_trade_no: input.order.outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: centsToAlipayAmount(input.order.amountCents),
      subject: input.description
    });

    const params: Record<string, string> = {
      app_id: appId,
      method: "alipay.trade.page.pay",
      format: "JSON",
      charset: "utf-8",
      sign_type: signType,
      timestamp: alipayTimestamp(),
      version: "1.0",
      notify_url: input.notifyUrl,
      return_url: input.returnUrl || "",
      biz_content: bizContent
    };

    if (!params.return_url) {
      delete params.return_url;
    }

    const signedParams = {
      ...params,
      sign: signAlipayParams(params, privateKey)
    };

    const query = new URLSearchParams(signedParams).toString();
    return {
      provider: "alipay",
      paymentMethod: "page",
      paymentUrl: `${gateway}?${query}`
    };
  }
}

export function parseAlipayNotify(rawBody: string): AlipayNotification {
  const params = paramsFromFormBody(rawBody);
  const publicKey = normalizePem(requireEnv("ALIPAY_PUBLIC_KEY"), "public");

  if (!verifyAlipayParams(params, publicKey)) {
    throw new Error("支付宝异步通知验签失败");
  }

  if (!params.out_trade_no) {
    throw new Error("支付宝异步通知缺少商户订单号");
  }
  if (!params.trade_status) {
    throw new Error("支付宝异步通知缺少交易状态");
  }
  if (!params.total_amount) {
    throw new Error("支付宝异步通知缺少订单金额");
  }

  return {
    app_id: params.app_id,
    out_trade_no: params.out_trade_no,
    trade_no: params.trade_no,
    trade_status: params.trade_status,
    total_amount: params.total_amount,
    raw: params
  };
}
