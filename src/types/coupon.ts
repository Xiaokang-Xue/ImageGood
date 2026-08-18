export type CouponStatus = "available" | "reserved" | "used";
export type CouponSource = "inviter_reward" | "invitee_reward";

export interface CouponRecord {
  id: string;
  userId: string;
  amountCents: number;
  source: CouponSource;
  status: CouponStatus;
  referralId: string;
  relatedUserId: string;
  inviteCode: string;
  reservedOrderId?: string | null;
  usedOrderId?: string | null;
  createdAt: string;
  usedAt?: string | null;
}

export interface ReferralRecord {
  id: string;
  inviterUserId: string;
  inviteeUserId: string;
  inviteCode: string;
  createdAt: string;
}

export interface AvailableCouponsResponse {
  coupons: Array<{
    id: string;
    amountCents: number;
    source: CouponSource;
    createdAt: string;
  }>;
}
