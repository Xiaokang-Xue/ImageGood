"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackClientEvent } from "@/lib/client-analytics";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;

    trackClientEvent({
      type: "page_view",
      path: `${pathname}${window.location.search || ""}`,
      referrer: document.referrer || ""
    });
  }, [pathname]);

  return null;
}
