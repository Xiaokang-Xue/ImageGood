import "server-only";
import { randomUUID } from "crypto";
import { withDb, type DbUser } from "@/lib/db";
import { generateUniqueInviteCode, normalizeInviteCode } from "@/lib/server/invite-code";
import type { CouponRecord, ReferralRecord } from "@/types/coupon";

const INVITE_COUPON_AMOUNT_CENTS = 1000;

type InvitationDb = {
  users: DbUser[];
  referrals: ReferralRecord[];
  coupons: CouponRecord[];
};

export class InvitationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "InvitationError";
    this.code = code;
    this.status = status;
  }
}

function inviterByCode(db: InvitationDb, inviteCode: string) {
  return db.users.find((user) => normalizeInviteCode(user.inviteCode || "") === inviteCode);
}

function createCoupon(input: {
  userId: string;
  source: CouponRecord["source"];
  referralId: string;
  relatedUserId: string;
  inviteCode: string;
  createdAt: string;
}): CouponRecord {
  return {
    id: randomUUID(),
    userId: input.userId,
    amountCents: INVITE_COUPON_AMOUNT_CENTS,
    source: input.source,
    status: "available",
    referralId: input.referralId,
    relatedUserId: input.relatedUserId,
    inviteCode: input.inviteCode,
    reservedOrderId: null,
    usedOrderId: null,
    createdAt: input.createdAt,
    usedAt: null
  };
}

export function applyInvitationAtRegistration(
  db: InvitationDb,
  invitee: DbUser,
  rawInviteCode?: string | null,
  createdAt = new Date().toISOString()
) {
  const inviteCode = normalizeInviteCode(rawInviteCode || "");
  if (!inviteCode) return null;
  if (inviteCode.length !== 8) {
    throw new InvitationError("INVALID_INVITE_CODE", "邀请码无效，请检查后重试");
  }
  if (invitee.invitedByUserId || db.referrals.some((item) => item.inviteeUserId === invitee.id)) {
    throw new InvitationError("ALREADY_INVITED", "每个账号只能接受一次好友邀请", 409);
  }

  const inviter = inviterByCode(db, inviteCode);
  if (!inviter) {
    throw new InvitationError("INVALID_INVITE_CODE", "邀请码无效，请检查后重试");
  }
  if (inviter.id === invitee.id) {
    throw new InvitationError("OWN_INVITE_CODE", "不能使用自己的邀请码");
  }

  const referral: ReferralRecord = {
    id: invitee.id,
    inviterUserId: inviter.id,
    inviteeUserId: invitee.id,
    inviteCode,
    createdAt
  };
  invitee.invitedByUserId = inviter.id;
  invitee.invitedAt = createdAt;
  db.referrals.push(referral);
  db.coupons.push(
    createCoupon({
      userId: inviter.id,
      source: "inviter_reward",
      referralId: referral.id,
      relatedUserId: invitee.id,
      inviteCode,
      createdAt
    }),
    createCoupon({
      userId: invitee.id,
      source: "invitee_reward",
      referralId: referral.id,
      relatedUserId: inviter.id,
      inviteCode,
      createdAt
    })
  );
  return referral;
}

export async function ensureUserInviteCode(userId: string) {
  return withDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) throw new InvitationError("USER_NOT_FOUND", "用户不存在", 404);
    const existing = normalizeInviteCode(user.inviteCode || "");
    if (existing) {
      if (user.inviteCode !== existing) user.inviteCode = existing;
      return existing;
    }
    const inviteCode = generateUniqueInviteCode(db.users);
    user.inviteCode = inviteCode;
    user.updatedAt = new Date().toISOString();
    return inviteCode;
  });
}
