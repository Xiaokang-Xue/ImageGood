import "server-only";
import { randomUUID } from "crypto";
import { CREDIT_PACKAGES, findCreditPackage } from "@/config/billing-plans";
import {
  getAdminOrderPage,
  getDbSnapshot,
  getDbUserById,
  getOrderById,
  getUserCreditTransactions,
  withDb
} from "@/lib/db";
import {
  availableCredits,
  consumeOneAvailableCredit,
  grantOrderCredits,
  hasUnlimitedAccess
} from "@/lib/server/credit-ledger";
import type {
  AdminOrderRecord,
  CreditPackageId,
  CreditTransactionRecord,
  OrderRecord
} from "@/types/billing";

export const creditPackages = CREDIT_PACKAGES;

export class BillingError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "BillingError";
    this.code = code;
    this.status = status;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export async function getCreditBalance(userId: string) {
  const user = await getDbUserById(userId);
  return user ? availableCredits(user) : 0;
}

export async function assertHasCredits(userId: string) {
  const user = await getDbUserById(userId);
  if (user && hasUnlimitedAccess(user)) return availableCredits(user);
  const credits = user ? availableCredits(user) : 0;
  if (credits <= 0) {
    throw new BillingError("INSUFFICIENT_CREDITS", "当前免费体验已使用，请选择创作方案后继续", 402);
  }
  return credits;
}

export async function consumeCredit(userId: string, reason = "图片生成") {
  return withDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) {
      throw new BillingError("INSUFFICIENT_CREDITS", "当前创作权益不足，请选择创作方案后继续", 402);
    }

    if (hasUnlimitedAccess(user)) return availableCredits(user);

    const consumed = consumeOneAvailableCredit(user);
    if (!consumed) {
      throw new BillingError("INSUFFICIENT_CREDITS", "当前免费体验已使用，请选择创作方案后继续", 402);
    }
    user.updatedAt = nowIso();
    db.creditTransactions.push({
      id: randomUUID(),
      userId,
      type: "consume",
      amount: -1,
      balanceAfter: consumed.balanceAfter,
      reason,
      createdAt: nowIso()
    });

    return consumed.balanceAfter;
  });
}

export async function listCreditTransactions(userId: string, limit = 50) {
  return getUserCreditTransactions(userId, limit);
}

export async function createOrder(userId: string, packageId: CreditPackageId) {
  const packageItem = findCreditPackage(packageId);
  if (!packageItem) {
    throw new BillingError("INVALID_PACKAGE", "创作方案不存在");
  }

  const order: OrderRecord = {
    id: randomUUID(),
    userId,
    packageId: packageItem.id,
    packageKind: packageItem.kind,
    packageName: packageItem.name,
    amountCents: packageItem.priceCents,
    credits: packageItem.credits,
    validityMonths: packageItem.validityMonths ?? null,
    validityDays: packageItem.validityDays ?? null,
    membershipLifetime: Boolean(packageItem.membershipLifetime),
    unlimitedGenerations: Boolean(packageItem.unlimitedGenerations),
    targetTaskId: null,
    periodDays: packageItem.periodDays ?? null,
    creditsPerPeriod: packageItem.creditsPerPeriod ?? null,
    status: "pending",
    paymentProvider: "manual",
    paymentMethod: "manual",
    outTradeNo: `MANUAL_${Date.now()}_${randomUUID().slice(0, 8)}`,
    transactionId: null,
    codeUrl: null,
    paymentUrl: null,
    remark: null,
    errorMessage: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    paidAt: null,
    expiredAt: null
  };

  await withDb((db) => {
    db.orders.push(order);
  });

  return order;
}

export async function getOrderForUser(orderId: string, userId: string, isAdmin = false) {
  const order = await getOrderById(orderId);
  if (!order || (!isAdmin && order.userId !== userId)) {
    return null;
  }
  return order;
}

export async function updateOrderRemark(orderId: string, userId: string, remark: string) {
  return withDb((db) => {
    const order = db.orders.find((item) => item.id === orderId && item.userId === userId);
    if (!order) {
      throw new BillingError("ORDER_NOT_FOUND", "订单不存在", 404);
    }
    if (order.status !== "pending") {
      throw new BillingError("ORDER_LOCKED", "当前订单状态不可修改");
    }
    order.remark = remark.trim().slice(0, 500);
    return order;
  });
}

function attachOrderUser(db: Awaited<ReturnType<typeof getDbSnapshot>>, order: OrderRecord): AdminOrderRecord {
  const user = db.users.find((item) => item.id === order.userId);
  const userAccount = user?.email || user?.phone?.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2") || "未知用户";
  return {
    ...order,
    userEmail: userAccount,
    userName: user?.name ?? null
  };
}

export async function listPendingOrders() {
  const db = await getDbSnapshot();
  return db.orders
    .filter((order) => order.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((order) => attachOrderUser(db, order));
}

export async function listAdminOrders(options?: Parameters<typeof getAdminOrderPage>[0]) {
  return getAdminOrderPage(options);
}

export async function confirmOrderPaid(orderId: string) {
  return withDb((db) => {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) {
      throw new BillingError("ORDER_NOT_FOUND", "订单不存在", 404);
    }
    if (order.status === "paid") {
      throw new BillingError("ORDER_ALREADY_PAID", "订单已确认，请勿重复操作");
    }
    if (order.status !== "pending") {
      throw new BillingError("ORDER_NOT_PAYABLE", "当前订单状态不可确认");
    }

    const user = db.users.find((item) => item.id === order.userId);
    if (!user) {
      throw new BillingError("USER_NOT_FOUND", "用户不存在", 404);
    }

    const now = nowIso();
    const grant = grantOrderCredits(user, order, now);
    if (order.packageKind === "single_unlock") {
      const task = order.targetTaskId
        ? db.imageTasks.find((item) => item.id === order.targetTaskId && item.userId === order.userId)
        : null;
      if (!task) {
        throw new BillingError("UNLOCK_TARGET_NOT_FOUND", "待解锁作品不存在", 404);
      }
      task.unlockedAt = now;
      task.updatedAt = now;
    }
    user.updatedAt = now;
    order.status = "paid";
    order.paidAt = now;
    order.updatedAt = now;

    const transaction: CreditTransactionRecord = {
      id: randomUUID(),
      userId: user.id,
      orderId: order.id,
      type: "purchase",
      amount: order.packageKind === "single_unlock" || order.unlimitedGenerations ? 0 : order.credits,
      balanceAfter: grant.balanceAfter,
      reason:
        order.packageKind === "single_unlock"
          ? `解锁无水印作品：${order.packageName}`
          : order.unlimitedGenerations
            ? `开通历史不限次方案：${order.packageName}`
            : order.packageKind === "membership"
              ? `开通历史会员：${order.packageName}`
              : `购买图片额度：${order.packageName}`,
      createdAt: now
    };
    db.creditTransactions.push(transaction);

    return { order, latestCredits: grant.balanceAfter };
  });
}
