"use client";

import { getCurrentUserCached } from "@/lib/client-current-user";

export async function refreshCreditsAfterGeneration() {
  const user = await getCurrentUserCached({ force: true });
  return user?.credits === 0;
}
