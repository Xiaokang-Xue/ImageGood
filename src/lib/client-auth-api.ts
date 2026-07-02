"use client";

import type { AuthResponse } from "@/types/user";

export async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me", {
    headers: { Accept: "application/json" },
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error("UNAUTHORIZED");
  return (await response.json()) as AuthResponse;
}

export async function logoutCurrentUser() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error("LOGOUT_FAILED");
}
