import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appendAnalyticsEvent } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { AnalyticsEventType } from "@/types/analytics";

export const runtime = "nodejs";

const MAX_ANALYTICS_EVENTS = 20_000;

function cleanPath(value: unknown) {
  const path = String(value || "").trim();
  if (!path || path.length > 240) return "/";
  if (!path.startsWith("/")) return "/";
  if (path.startsWith("/api/")) return "/";
  return path;
}

function cleanText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanEventType(value: unknown): AnalyticsEventType {
  if (value === "acquisition_channel") return "acquisition_channel";
  return value === "purchase_click" ? "purchase_click" : "page_view";
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 12)
    .map(([key, item]) => {
      if (typeof item === "string") return [key.slice(0, 40), item.slice(0, 120)] as const;
      if (typeof item === "number" && Number.isFinite(item)) return [key.slice(0, 40), item] as const;
      if (typeof item === "boolean" || item === null) return [key.slice(0, 40), item] as const;
      return null;
    })
    .filter(Boolean) as Array<readonly [string, string | number | boolean | null]>;

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as Partial<{
    type: AnalyticsEventType;
    path: string;
    referrer: string;
    target: string;
    metadata: Record<string, string | number | boolean | null>;
    visitorId: string;
    sessionId: string;
  }>;

  const visitorId = cleanText(payload.visitorId, 80);
  const sessionId = cleanText(payload.sessionId, 80);

  if (!visitorId || !sessionId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const user = await getCurrentUser();
  const userAgent = cleanText(request.headers.get("user-agent"), 300);
  const event = {
    id: randomUUID(),
    type: cleanEventType(payload.type),
    path: cleanPath(payload.path),
    target: cleanText(payload.target, 120),
    metadata: cleanMetadata(payload.metadata),
    referrer: cleanText(payload.referrer, 240),
    visitorId,
    sessionId,
    userId: user?.id ?? null,
    userAgent,
    createdAt: new Date().toISOString()
  };

  try {
    await appendAnalyticsEvent(event, MAX_ANALYTICS_EVENTS);
  } catch (error) {
    console.error("[analytics] failed to append page view", {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return NextResponse.json({ ok: true });
}
