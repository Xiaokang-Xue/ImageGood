"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function browserId(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;

  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(key, next);
  return next;
}

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;

    const visitorId = browserId(window.localStorage, "imagegood_visitor_id");
    const sessionId = browserId(window.sessionStorage, "imagegood_session_id");
    const path = `${pathname}${window.location.search || ""}`;
    const payload = JSON.stringify({
      path,
      referrer: document.referrer || "",
      visitorId,
      sessionId
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
  }, [pathname]);

  return null;
}
