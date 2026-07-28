export interface MembershipCreditAccount {
  credits: number;
  membershipCredits?: number;
  membershipExpiresAt?: string | null;
  membershipPlan?: string | null;
  membershipLifetime?: boolean;
  membershipNextRefreshAt?: string | null;
  membershipCreditsPerPeriod?: number;
  membershipPeriodDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTime(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function resetMembership(account: MembershipCreditAccount) {
  account.membershipCredits = 0;
  account.membershipExpiresAt = null;
  account.membershipPlan = null;
  account.membershipLifetime = false;
  account.membershipNextRefreshAt = null;
  account.membershipCreditsPerPeriod = 0;
  account.membershipPeriodDays = 0;
}

export function refreshMembershipCredits(
  account: MembershipCreditAccount,
  now = Date.now()
) {
  const expiresAt = parseTime(account.membershipExpiresAt);
  if (!account.membershipLifetime && (!expiresAt || expiresAt <= now)) {
    const hadMembership =
      Boolean(account.membershipPlan) ||
      Boolean(account.membershipCredits) ||
      Boolean(account.membershipNextRefreshAt);
    if (hadMembership) resetMembership(account);
    return hadMembership;
  }

  const creditsPerPeriod = Math.max(0, Math.trunc(account.membershipCreditsPerPeriod ?? 0));
  const periodDays = Math.max(0, Math.trunc(account.membershipPeriodDays ?? 0));
  const nextRefreshAt = parseTime(account.membershipNextRefreshAt);
  if (!creditsPerPeriod || !periodDays || !nextRefreshAt || nextRefreshAt > now) {
    return false;
  }

  const periodMs = periodDays * DAY_MS;
  const latestEligibleRefreshAt =
    !account.membershipLifetime && expiresAt ? expiresAt - periodMs : Number.POSITIVE_INFINITY;
  if (nextRefreshAt > latestEligibleRefreshAt) {
    account.membershipNextRefreshAt = new Date(expiresAt).toISOString();
    return true;
  }

  const refreshThrough = Math.min(now, latestEligibleRefreshAt);
  const elapsedPeriods = Math.floor((refreshThrough - nextRefreshAt) / periodMs) + 1;
  let followingRefreshAt = nextRefreshAt + elapsedPeriods * periodMs;
  if (
    !account.membershipLifetime &&
    expiresAt &&
    followingRefreshAt > latestEligibleRefreshAt
  ) {
    followingRefreshAt = expiresAt;
  }

  account.membershipCredits = creditsPerPeriod;
  account.membershipNextRefreshAt = new Date(followingRefreshAt).toISOString();
  return true;
}

export function getActiveMembershipCredits(account: MembershipCreditAccount, now = Date.now()) {
  refreshMembershipCredits(account, now);
  const expiresAt = parseTime(account.membershipExpiresAt);
  if (!account.membershipLifetime && (!expiresAt || expiresAt <= now)) return 0;
  return Math.max(0, Math.trunc(account.membershipCredits ?? 0));
}

export function hasActiveMembership(account: MembershipCreditAccount, now = Date.now()) {
  refreshMembershipCredits(account, now);
  if (account.membershipLifetime) return true;
  const expiresAt = parseTime(account.membershipExpiresAt);
  return expiresAt > now;
}

export function getAvailableCreditBalance(account: MembershipCreditAccount, now = Date.now()) {
  return Math.max(0, Math.trunc(account.credits || 0)) + getActiveMembershipCredits(account, now);
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

export function addMembershipDays(baseIso: string | null | undefined, days: number, now = Date.now()) {
  const existing = parseTime(baseIso);
  const start = existing > now ? existing : now;
  return new Date(start + Math.max(1, Math.trunc(days)) * DAY_MS).toISOString();
}
