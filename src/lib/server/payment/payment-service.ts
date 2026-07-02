import "server-only";
import { randomUUID } from "crypto";
import { access } from "fs/promises";
import { CREDIT_PACKAGES, findCreditPackage } from "@/config/billing-plans";
import {
  getDbSnapshot,
  getDbUserById,
  getOrderById,
  getOrderByOutTradeNo,
  hasPaymentSourceSurveyRecord,
  withDb
} from "@/lib/db";
import { AlipayProvider, alipayAmountToCents, parseAlipayNotify } from "@/lib/server/payment/alipay-provider";
import { MockPaymentProvider } from "@/lib/server/payment/mock-payment-provider";
import { WechatPayProvider, parseWechatPaymentNotify } from "@/lib/server/payment/wechat-pay-provider";
import type { CreditPackageId, CreditTransactionRecord, OrderRecord, PaymentOrderResponse } from "@/types/billing";
import type {
  PaymentProvider,
  PaymentProviderName,
  WechatPaymentNotification
} from "@/lib/server/payment/payment-provider";
import type { AlipayNotification } from "@/lib/server/payment/alipay-provider";
import type { PublicUser } from "@/types/user";

export class PaymentError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function paymentErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    name: "UnknownError",
    message: String(error)
  };
}

export function getPaymentMode(): "mock" | "real" {
  return process.env.PAYMENT_MODE === "real" ? "real" : "mock";
}

function getPaymentProvider(providerName: PaymentProviderName): PaymentProvider {
  if (getPaymentMode() === "real") {
    if (providerName === "alipay") {
      return new AlipayProvider();
    }
    return new WechatPayProvider();
  }
  return new MockPaymentProvider();
}

async function assertReadableFile(filePath: string | undefined, label: string) {
  if (!filePath) {
    throw new PaymentError("PAYMENT_CONFIG_INCOMPLETE", `${label}未配置`, 503);
  }

  try {
    await access(filePath);
  } catch {
    throw new PaymentError("PAYMENT_CONFIG_INCOMPLETE", `${label}文件不存在或不可读取`, 503);
  }
}

async function assertWechatPaymentConfigReady() {
  if (getPaymentMode() !== "real") return;

  const required = [
    ["WECHAT_PAY_APPID", "微信支付 APPID"],
    ["WECHAT_PAY_MCH_ID", "微信支付商户号"],
    ["WECHAT_PAY_API_V3_KEY", "微信支付 APIv3 密钥"],
    ["WECHAT_PAY_MERCHANT_SERIAL_NO", "商户 API 证书序列号"],
    ["WECHAT_PAY_PLATFORM_CERT_SERIAL_NO", "微信支付平台证书序列号"],
    ["WECHAT_PAY_NOTIFY_URL", "微信支付回调地址"]
  ] as const;

  for (const [envName, label] of required) {
    if (!process.env[envName]) {
      throw new PaymentError("PAYMENT_CONFIG_INCOMPLETE", `${label}未配置`, 503);
    }
  }

  await assertReadableFile(process.env.WECHAT_PAY_PRIVATE_KEY_PATH, "商户 API 私钥");
  await assertReadableFile(process.env.WECHAT_PAY_PLATFORM_CERT_PATH, "微信支付平台证书");
}

async function assertAlipayConfigReady() {
  if (getPaymentMode() !== "real") return;
  if (process.env.ALIPAY_ENABLED !== "true") {
    throw new PaymentError("ALIPAY_DISABLED", "支付宝支付暂未启用", 503);
  }

  const required = [
    ["ALIPAY_APP_ID", "支付宝 AppID"],
    ["ALIPAY_APP_PRIVATE_KEY", "支付宝应用私钥"],
    ["ALIPAY_PUBLIC_KEY", "支付宝公钥"],
    ["ALIPAY_NOTIFY_URL", "支付宝异步通知地址"],
    ["ALIPAY_RETURN_URL", "支付宝返回地址"]
  ] as const;

  for (const [envName, label] of required) {
    if (!process.env[envName]) {
      throw new PaymentError("PAYMENT_CONFIG_INCOMPLETE", `${label}未配置`, 503);
    }
  }
}

async function assertPaymentConfigReady(providerName: PaymentProviderName) {
  if (providerName === "alipay") {
    await assertAlipayConfigReady();
    return;
  }

  await assertWechatPaymentConfigReady();
}

function getWechatNotifyUrl() {
  if (process.env.WECHAT_PAY_NOTIFY_URL) {
    return process.env.WECHAT_PAY_NOTIFY_URL;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/api/payment/wechat/notify`;
}

function getAlipayNotifyUrl() {
  if (process.env.ALIPAY_NOTIFY_URL) {
    return process.env.ALIPAY_NOTIFY_URL;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/api/payment/alipay/notify`;
}

function getAlipayReturnUrl(orderId: string) {
  const baseUrl =
    process.env.ALIPAY_RETURN_URL ||
    `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/checkout/alipay/return`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}orderId=${encodeURIComponent(orderId)}`;
}

function generateOutTradeNo() {
  return `AIIMG_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function providerForOrder(order: OrderRecord): PaymentProviderName | undefined {
  if (order.paymentProvider === "wechat" || order.paymentProvider === "alipay") {
    return order.paymentProvider;
  }
  return undefined;
}

function createPendingOrder(userId: string, packageId: CreditPackageId, providerName: PaymentProviderName): OrderRecord {
  const packageItem = findCreditPackage(packageId);
  if (!packageItem) {
    throw new PaymentError("INVALID_PACKAGE", "积分包不存在", 404);
  }

  const now = nowIso();
  return {
    id: randomUUID(),
    userId,
    packageId: packageItem.id,
    packageName: packageItem.name,
    amountCents: packageItem.priceCents,
    credits: packageItem.credits,
    status: "pending",
    paymentProvider: providerName,
    paymentMethod: providerName === "alipay" ? "page" : "native",
    outTradeNo: generateOutTradeNo(),
    transactionId: null,
    codeUrl: null,
    paymentUrl: null,
    remark: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
    expiredAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
}

export async function listPaymentPackages() {
  return CREDIT_PACKAGES;
}

export async function createPaymentOrder(userId: string, packageId: CreditPackageId, providerName: PaymentProviderName = "alipay") {
  if (providerName !== "wechat" && providerName !== "alipay") {
    throw new PaymentError("INVALID_PAYMENT_PROVIDER", "不支持的支付方式", 400);
  }

  await assertPaymentConfigReady(providerName);
  const provider = getPaymentProvider(providerName);
  const order = createPendingOrder(userId, packageId, providerName);

  await withDb((db) => {
    if (db.orders.some((item) => item.outTradeNo === order.outTradeNo)) {
      throw new PaymentError("DUPLICATE_OUT_TRADE_NO", "订单号生成失败，请重试");
    }
    db.orders.push(order);
  });

  try {
    const payment = await provider.createPayment({
      order,
      description: `ImageGood 积分包 - ${order.packageName}`,
      notifyUrl: providerName === "alipay" ? getAlipayNotifyUrl() : getWechatNotifyUrl(),
      returnUrl: providerName === "alipay" ? getAlipayReturnUrl(order.id) : undefined
    });

    const updated = await withDb((db) => {
      const current = db.orders.find((item) => item.id === order.id);
      if (!current) {
        throw new PaymentError("ORDER_NOT_FOUND", "订单不存在", 404);
      }
      current.paymentProvider = payment.provider;
      current.paymentMethod = payment.paymentMethod;
      current.codeUrl = payment.codeUrl ?? null;
      current.paymentUrl = payment.paymentUrl ?? null;
      current.updatedAt = nowIso();
      return current;
    });

    return updated;
  } catch (error) {
    console.error("[payment] create native payment failed", {
      orderId: order.id,
      outTradeNo: order.outTradeNo,
      paymentMode: getPaymentMode(),
      paymentProvider: providerName,
      ...paymentErrorDetails(error)
    });

    await withDb((db) => {
      const current = db.orders.find((item) => item.id === order.id);
      if (!current) return;
      current.status = "failed";
      current.errorMessage = error instanceof Error ? error.message : "创建支付订单失败";
      current.updatedAt = nowIso();
    });
    throw new PaymentError("PAYMENT_CREATE_FAILED", "创建支付订单失败，请稍后重试", 502);
  }
}

export async function getOrderForViewer(orderId: string, user: PublicUser) {
  const order = await getOrderById(orderId);
  if (!order || (user.role !== "admin" && order.userId !== user.id)) {
    return null;
  }
  return order;
}

async function expireOrderIfNeeded(orderId: string) {
  const existing = await getOrderById(orderId);
  if (
    !existing ||
    existing.status !== "pending" ||
    !existing.expiredAt ||
    new Date(existing.expiredAt).getTime() > Date.now()
  ) {
    return;
  }

  await withDb((db) => {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "pending" || !order.expiredAt) return;
    if (new Date(order.expiredAt).getTime() > Date.now()) return;
    order.status = "expired";
    order.updatedAt = nowIso();
  });
}

export async function getPaymentOrderResponse(orderId: string, user: PublicUser): Promise<PaymentOrderResponse | null> {
  await expireOrderIfNeeded(orderId);
  const order = await getOrderById(orderId);
  if (!order || (user.role !== "admin" && order.userId !== user.id)) {
    return null;
  }

  const [owner, sourceSurveySubmitted] = await Promise.all([
    getDbUserById(order.userId),
    hasPaymentSourceSurveyRecord(order.userId, order.id)
  ]);
  return {
    orderId: order.id,
    status: order.status,
    packageName: order.packageName,
    amountCents: order.amountCents,
    credits: order.credits,
    codeUrl: order.codeUrl ?? null,
    paymentUrl: order.paymentUrl ?? null,
    paidAt: order.paidAt ?? null,
    currentCredits: owner?.credits ?? 0,
    paymentProvider: order.paymentProvider,
    paymentMethod: order.paymentMethod,
    outTradeNo: order.outTradeNo,
    transactionId: order.transactionId ?? null,
    expiredAt: order.expiredAt ?? null,
    paymentMode: getPaymentMode(),
    sourceSurveySubmitted
  };
}

export async function getPaymentOrderResponseByOutTradeNo(
  outTradeNo: string,
  user: PublicUser
): Promise<PaymentOrderResponse | null> {
  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order) return null;
  return getPaymentOrderResponse(order.id, user);
}

function assertSuccessfulPayment(order: OrderRecord, payment: {
  outTradeNo: string;
  amountCents: number;
  tradeState: string;
  provider?: PaymentProviderName;
  mchid?: string;
}) {
  if (payment.tradeState !== "SUCCESS") {
    throw new PaymentError("PAYMENT_NOT_SUCCESS", "支付状态不是成功");
  }

  if (payment.provider && order.paymentProvider !== payment.provider) {
    throw new PaymentError("PAYMENT_PROVIDER_MISMATCH", "支付渠道不匹配", 400);
  }

  if (payment.provider === "wechat" && getPaymentMode() === "real" && payment.mchid && payment.mchid !== process.env.WECHAT_PAY_MCH_ID) {
    throw new PaymentError("MCH_ID_MISMATCH", "商户号不匹配", 400);
  }

  if (order.outTradeNo !== payment.outTradeNo) {
    throw new PaymentError("ORDER_NO_MISMATCH", "商户订单号不匹配", 400);
  }

  if (order.amountCents !== payment.amountCents) {
    throw new PaymentError("AMOUNT_MISMATCH", "订单金额不一致", 400);
  }
}

export async function markOrderPaid(input: {
  outTradeNo: string;
  amountCents: number;
  tradeState: string;
  provider?: PaymentProviderName;
  transactionId?: string | null;
  mchid?: string;
  paidAt?: string | null;
  reason?: string;
  transactionType?: CreditTransactionRecord["type"];
}) {
  let failedError: PaymentError | null = null;
  const result = await withDb((db) => {
    const order = db.orders.find((item) => item.outTradeNo === input.outTradeNo);
    if (!order) {
      throw new PaymentError("ORDER_NOT_FOUND", "订单不存在", 404);
    }

    if (order.status === "paid") {
      assertSuccessfulPayment(order, input);
      const user = db.users.find((item) => item.id === order.userId);
      return { order, latestCredits: user?.credits ?? 0, alreadyPaid: true };
    }

    try {
      assertSuccessfulPayment(order, input);
    } catch (error) {
      order.status = "failed";
      order.errorMessage = error instanceof Error ? error.message : "支付回调校验失败";
      order.updatedAt = nowIso();
      failedError = error instanceof PaymentError ? error : new PaymentError("PAYMENT_VERIFY_FAILED", order.errorMessage, 400);
      return { order, latestCredits: 0, alreadyPaid: false };
    }

    const user = db.users.find((item) => item.id === order.userId);
    if (!user) {
      throw new PaymentError("USER_NOT_FOUND", "用户不存在", 404);
    }

    const now = input.paidAt || nowIso();
    user.credits += order.credits;
    user.updatedAt = now;
    order.status = "paid";
    order.transactionId = input.transactionId ?? order.transactionId ?? null;
    order.paidAt = now;
    order.updatedAt = now;
    order.errorMessage = null;

    db.creditTransactions.push({
      id: randomUUID(),
      userId: user.id,
      orderId: order.id,
      type: input.transactionType ?? "purchase",
      amount: order.credits,
      balanceAfter: user.credits,
      reason: input.reason ?? `购买积分包：${order.packageName}`,
      createdAt: now
    });

    return { order, latestCredits: user.credits, alreadyPaid: false };
  });

  if (failedError) {
    throw failedError;
  }

  return result;
}

export async function handleWechatPaymentNotify(rawBody: string, headers: Headers) {
  const payment = await parseWechatPaymentNotify(rawBody, headers);
  await processWechatPayment(payment);
}

export async function processWechatPayment(payment: WechatPaymentNotification) {
  if (!payment.out_trade_no) {
    throw new PaymentError("OUT_TRADE_NO_MISSING", "微信支付回调缺少商户订单号", 400);
  }

  await markOrderPaid({
    outTradeNo: payment.out_trade_no,
    amountCents: payment.amount?.total ?? 0,
    tradeState: payment.trade_state,
    provider: "wechat",
    transactionId: payment.transaction_id ?? null,
    mchid: payment.mchid,
    reason: "微信支付购买积分包",
    transactionType: "purchase"
  });
}

export async function handleAlipayPaymentNotify(rawBody: string) {
  const payment = parseAlipayNotify(rawBody);
  await processAlipayPayment(payment);
}

export async function processAlipayPayment(payment: AlipayNotification) {
  if (getPaymentMode() === "real" && payment.app_id !== process.env.ALIPAY_APP_ID) {
    throw new PaymentError("APP_ID_MISMATCH", "支付宝 AppID 不匹配", 400);
  }

  if (payment.trade_status !== "TRADE_SUCCESS" && payment.trade_status !== "TRADE_FINISHED") {
    throw new PaymentError("PAYMENT_NOT_SUCCESS", "支付宝交易状态不是成功", 400);
  }

  await markOrderPaid({
    outTradeNo: payment.out_trade_no,
    amountCents: alipayAmountToCents(payment.total_amount),
    tradeState: "SUCCESS",
    provider: "alipay",
    transactionId: payment.trade_no ?? null,
    reason: "支付宝购买积分包",
    transactionType: "purchase"
  });
}

export async function markMockPaymentPaid(user: PublicUser, orderId: string) {
  if (getPaymentMode() !== "mock") {
    throw new PaymentError("MOCK_PAYMENT_DISABLED", "当前环境不允许模拟支付", 403);
  }

  const db = await getDbSnapshot();
  const order = db.orders.find((item) => item.id === orderId);
  if (!order || (user.role !== "admin" && order.userId !== user.id)) {
    throw new PaymentError("ORDER_NOT_FOUND", "订单不存在或无权限访问", 404);
  }

  return markOrderPaid({
    outTradeNo: order.outTradeNo,
    amountCents: order.amountCents,
    tradeState: "SUCCESS",
    provider: providerForOrder(order),
    transactionId: `MOCK_${Date.now()}`,
    mchid: order.paymentProvider === "wechat" ? process.env.WECHAT_PAY_MCH_ID || "mock_mchid" : undefined,
    reason: "本地调试模式支付成功",
    transactionType: "purchase"
  });
}

export async function adminAdjustOrderCredits(orderId: string) {
  const db = await getDbSnapshot();
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new PaymentError("ORDER_NOT_FOUND", "订单不存在", 404);
  }
  if (order.status === "paid") {
    throw new PaymentError("ORDER_ALREADY_PAID", "订单已完成，请勿重复补发");
  }

  return markOrderPaid({
    outTradeNo: order.outTradeNo,
    amountCents: order.amountCents,
    tradeState: "SUCCESS",
    provider: providerForOrder(order),
    transactionId: `ADMIN_ADJUST_${Date.now()}`,
    mchid: order.paymentProvider === "wechat" ? process.env.WECHAT_PAY_MCH_ID || "admin_adjust" : undefined,
    reason: `管理员异常补发积分：${order.packageName}`,
    transactionType: "admin_adjust"
  });
}
