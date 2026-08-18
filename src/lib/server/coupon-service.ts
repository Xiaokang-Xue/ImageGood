import "server-only";
import { randomUUID } from "crypto";
import { withDb, type DbUser } from "@/lib/db";
import type { CreditPackage, OrderRecord } from "@/types/billing";
import type { AvailableCouponsResponse, CouponRecord } from "@/types/coupon";

type CouponDb = {
  users: DbUser[];
  orders: OrderRecord[];
  coupons: CouponRecord[];
};

export class CouponError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CouponError";
    this.code = code;
    this.status = status;
  }
}

function releaseStaleReservations(db: CouponDb, userId?: string) {
  const now = Date.now();
  for (const coupon of db.coupons) {
    if (coupon.status !== "reserved" || !coupon.reservedOrderId || (userId && coupon.userId !== userId)) continue;
    const order = db.orders.find((item) => item.id === coupon.reservedOrderId);
    const expiredPending = order?.status === "pending" && order.expiredAt && new Date(order.expiredAt).getTime() <= now;
    if (expiredPending && order) {
      order.status = "expired";
      order.updatedAt = new Date().toISOString();
    }
    if (!order || order.status === "failed" || order.status === "cancelled" || order.status === "expired") {
      coupon.status = "available";
      coupon.reservedOrderId = null;
    }
  }
}

function activePendingOrder(db: CouponDb, userId: string) {
  const now = Date.now();
  return db.orders.find(
    (order) =>
      order.userId === userId &&
      order.status === "pending" &&
      (!order.expiredAt || new Date(order.expiredAt).getTime() > now)
  );
}

export function prepareCouponOrder(input: {
  db: CouponDb;
  user: DbUser;
  packageItem: CreditPackage;
  couponId?: string | null;
  orderId: string;
}) {
  releaseStaleReservations(input.db, input.user.id);
  if (activePendingOrder(input.db, input.user.id)) {
    throw new CouponError("PAYMENT_ORDER_PENDING", "已有待支付订单，请完成支付或稍后再试", 409);
  }

  input.user.paymentOrderGuard = randomUUID();
  const originalAmountCents = input.packageItem.priceCents;
  if (!input.couponId) {
    return { couponId: null, couponAmountCents: 0, originalAmountCents, discountAmountCents: 0, paidAmountCents: originalAmountCents };
  }

  const coupon = input.db.coupons.find((item) => item.id === input.couponId);
  if (!coupon || coupon.userId !== input.user.id) {
    throw new CouponError("COUPON_NOT_FOUND", "优惠券不存在或不属于当前账号", 404);
  }
  if (coupon.status !== "available") {
    throw new CouponError("COUPON_NOT_AVAILABLE", "该优惠券已使用或正在其他订单中使用", 409);
  }

  const couponAmountCents = Math.min(coupon.amountCents, Math.max(0, originalAmountCents - 1));
  if (couponAmountCents <= 0) {
    throw new CouponError("COUPON_NOT_APPLICABLE", "该优惠券不适用于当前创作方案");
  }
  coupon.status = "reserved";
  coupon.reservedOrderId = input.orderId;
  return {
    couponId: coupon.id,
    couponAmountCents,
    originalAmountCents,
    discountAmountCents: couponAmountCents,
    paidAmountCents: originalAmountCents - couponAmountCents
  };
}

export function releaseCouponForOrder(db: CouponDb, order: OrderRecord) {
  if (!order.couponId) return;
  const coupon = db.coupons.find((item) => item.id === order.couponId && item.userId === order.userId);
  if (!coupon || coupon.status !== "reserved" || coupon.reservedOrderId !== order.id) return;
  coupon.status = "available";
  coupon.reservedOrderId = null;
}

export function markCouponUsed(db: CouponDb, order: OrderRecord, usedAt: string) {
  if (!order.couponId) return;
  const coupon = db.coupons.find((item) => item.id === order.couponId && item.userId === order.userId);
  if (!coupon) throw new CouponError("COUPON_NOT_FOUND", "订单优惠券不存在", 409);
  if (coupon.status === "used" && coupon.usedOrderId === order.id) return;
  if (coupon.status !== "reserved" || coupon.reservedOrderId !== order.id) {
    throw new CouponError("COUPON_STATE_INVALID", "订单优惠券状态异常", 409);
  }
  coupon.status = "used";
  coupon.usedOrderId = order.id;
  coupon.reservedOrderId = null;
  coupon.usedAt = usedAt;
}

export async function listAvailableCoupons(userId: string): Promise<AvailableCouponsResponse> {
  return withDb((db) => {
    releaseStaleReservations(db, userId);
    return {
      coupons: db.coupons
        .filter((coupon) => coupon.userId === userId && coupon.status === "available")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(({ id, amountCents, source, createdAt }) => ({ id, amountCents, source, createdAt }))
    };
  });
}
