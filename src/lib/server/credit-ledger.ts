import "server-only";
import {
  addMembershipMonths,
  clearExpiredMembershipCredits,
  getAvailableCreditBalance
} from "@/lib/credit-balance";
import type { DbUser } from "@/lib/db";
import type { OrderRecord } from "@/types/billing";

export function availableCredits(user: DbUser, now = Date.now()) {
  clearExpiredMembershipCredits(user, now);
  return getAvailableCreditBalance(user, now);
}

export function consumeOneAvailableCredit(user: DbUser, now = Date.now()) {
  clearExpiredMembershipCredits(user, now);
  if ((user.membershipCredits ?? 0) > 0) {
    user.membershipCredits = Math.max(0, (user.membershipCredits ?? 0) - 1);
    return { source: "membership" as const, balanceAfter: getAvailableCreditBalance(user, now) };
  }
  if (user.credits > 0) {
    user.credits -= 1;
    return { source: "permanent" as const, balanceAfter: getAvailableCreditBalance(user, now) };
  }
  return null;
}

export function grantOrderCredits(user: DbUser, order: OrderRecord, nowIso: string) {
  const now = new Date(nowIso).getTime();
  clearExpiredMembershipCredits(user, now);
  if (order.packageKind === "membership") {
    const validityMonths = Math.max(1, order.validityMonths ?? 1);
    user.membershipCredits = (user.membershipCredits ?? 0) + order.credits;
    user.membershipExpiresAt = addMembershipMonths(user.membershipExpiresAt, validityMonths, now);
    user.membershipPlan = order.packageName;
    return {
      source: "membership" as const,
      balanceAfter: getAvailableCreditBalance(user, now),
      membershipExpiresAt: user.membershipExpiresAt
    };
  }

  user.credits += order.credits;
  return {
    source: "permanent" as const,
    balanceAfter: getAvailableCreditBalance(user, now),
    membershipExpiresAt: user.membershipExpiresAt ?? null
  };
}
