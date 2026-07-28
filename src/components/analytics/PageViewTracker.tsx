"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackClientEvent } from "@/lib/client-analytics";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;

    const send = () => {
      trackClientEvent({
        type: "page_view",
        path: `${pathname}${window.location.search || ""}`,
        referrer: document.referrer || ""
      });
    };

    const browser = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (browser.requestIdleCallback) {
      const idleId = browser.requestIdleCallback(send, { timeout: 1500 });
      return () => browser.cancelIdleCallback?.(idleId);
    }

    const timer = window.setTimeout(send, 500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
