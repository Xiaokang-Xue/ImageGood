"use client";

import type { AnalyticsEventType } from "@/types/analytics";
import { safeBrowserId } from "@/lib/safe-client-storage";

interface TrackClientEventInput {
  type?: AnalyticsEventType;
  path?: string;
  referrer?: string;
  target?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export function trackClientEvent(input: TrackClientEventInput = {}) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    type: input.type ?? "page_view",
    path: input.path ?? `${window.location.pathname}${window.location.search || ""}`,
    referrer: input.referrer ?? document.referrer ?? "",
    target: input.target ?? null,
    metadata: input.metadata ?? null,
    visitorId: safeBrowserId(window.localStorage, "imagegood_visitor_id"),
    sessionId: safeBrowserId(window.sessionStorage, "imagegood_session_id")
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/track", blob);
    return;
  }

  fetch("/api/analytics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload,
    keepalive: true
  }).catch(() => null);
}
