export interface MembershipCreditAccount {
  credits: number;
  membershipCredits?: number;
  membershipExpiresAt?: string | null;
  membershipPlan?: string | null;
}

export function getActiveMembershipCredits(account: MembershipCreditAccount, now = Date.now()) {
  const expiresAt = account.membershipExpiresAt
    ? new Date(account.membershipExpiresAt).getTime()
    : 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return 0;
  return Math.max(0, Math.trunc(account.membershipCredits ?? 0));
}

export function getAvailableCreditBalance(account: MembershipCreditAccount, now = Date.now()) {
  return Math.max(0, Math.trunc(account.credits || 0)) + getActiveMembershipCredits(account, now);
}

export function clearExpiredMembershipCredits(
  account: MembershipCreditAccount,
  now = Date.now()
) {
  if (!account.membershipExpiresAt) return false;
  const expiresAt = new Date(account.membershipExpiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > now) return false;
  account.membershipCredits = 0;
  account.membershipExpiresAt = null;
  account.membershipPlan = null;
  return true;
}

export function addMembershipMonths(baseIso: string | null | undefined, months: number, now = Date.now()) {
  const existing = baseIso ? new Date(baseIso).getTime() : 0;
  const start = new Date(Number.isFinite(existing) && existing > now ? existing : now);
  const originalDay = start.getUTCDate();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(originalDay, lastDay));
  return start.toISOString();
}
