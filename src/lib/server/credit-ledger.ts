import "server-only";
import {
  addMembershipDays,
  addMembershipMonths,
  getAvailableCreditBalance,
  refreshMembershipCredits
} from "@/lib/credit-balance";
import type { DbUser } from "@/lib/db";
import type { OrderRecord } from "@/types/billing";

export function availableCredits(user: DbUser, now = Date.now()) {
  refreshMembershipCredits(user, now);
  return getAvailableCreditBalance(user, now);
}

export function consumeOneAvailableCredit(user: DbUser, now = Date.now()) {
  refreshMembershipCredits(user, now);
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
  refreshMembershipCredits(user, now);
  if (order.packageKind === "membership") {
    const previousExpiry = user.membershipExpiresAt;
    const wasActive =
      Boolean(user.membershipLifetime) ||
      Boolean(previousExpiry && new Date(previousExpiry).getTime() > now);
    const wasPeriodic = Boolean(
      user.membershipCreditsPerPeriod &&
      user.membershipPeriodDays &&
      user.membershipNextRefreshAt
    );
    const creditsPerPeriod = Math.max(1, order.creditsPerPeriod ?? order.credits);
    const periodDays = Math.max(1, order.periodDays ?? 30);

    if (!wasActive) {
      user.membershipCredits = creditsPerPeriod;
      user.membershipNextRefreshAt = new Date(now + periodDays * 24 * 60 * 60 * 1000).toISOString();
    } else if (!wasPeriodic) {
      // Preserve credits issued by legacy memberships, then enter the new cycle.
      user.membershipNextRefreshAt =
        previousExpiry ?? new Date(now + periodDays * 24 * 60 * 60 * 1000).toISOString();
    }

    if (order.membershipLifetime || user.membershipLifetime) {
      user.membershipLifetime = true;
      user.membershipExpiresAt = null;
    } else {
      user.membershipLifetime = false;
      user.membershipExpiresAt = order.validityDays
        ? addMembershipDays(previousExpiry, order.validityDays, now)
        : addMembershipMonths(previousExpiry, Math.max(1, order.validityMonths ?? 1), now);
    }

    user.membershipCreditsPerPeriod = creditsPerPeriod;
    user.membershipPeriodDays = periodDays;
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
