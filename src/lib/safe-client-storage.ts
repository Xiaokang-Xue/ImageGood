"use client";

const IMAGE_URL_MAX_LENGTH = 2048;

export function isPersistableImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value) return false;
  if (value.length > IMAGE_URL_MAX_LENGTH) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  return true;
}

export function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage in private mode or embedded browsers.
  }
}

export function safeBrowserId(storage: Storage, key: string) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;

    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    storage.setItem(key, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
