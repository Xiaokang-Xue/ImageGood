"use client";

import { fetchCurrentUser } from "@/lib/client-auth-api";
import type { PublicUser } from "@/types/user";

const CACHE_TTL_MS = 30_000;

let cachedUser: PublicUser | null | undefined;
let cacheExpiresAt = 0;
let pendingRequest: Promise<PublicUser | null> | null = null;
const listeners = new Set<(user: PublicUser | null) => void>();

function publish(user: PublicUser | null) {
  for (const listener of listeners) listener(user);
}

export function setCurrentUserCache(user: PublicUser | null) {
  cachedUser = user;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  publish(user);
}

export function clearCurrentUserCache() {
  cachedUser = null;
  cacheExpiresAt = 0;
  pendingRequest = null;
  publish(null);
}

export function subscribeCurrentUser(listener: (user: PublicUser | null) => void) {
  listeners.add(listener);
  if (cachedUser !== undefined) listener(cachedUser);
  return () => listeners.delete(listener);
}

export async function getCurrentUserCached(options?: { force?: boolean }) {
  const force = options?.force === true;
  if (!force && cachedUser !== undefined && Date.now() < cacheExpiresAt) {
    return cachedUser;
  }
  if (!force && pendingRequest) return pendingRequest;

  pendingRequest = fetchCurrentUser()
    .then((response) => {
      setCurrentUserCache(response.user);
      return response.user;
    })
    .catch(() => {
      setCurrentUserCache(null);
      return null;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}
