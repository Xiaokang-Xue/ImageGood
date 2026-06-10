import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appendAnalyticsEvent } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

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

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as Partial<{
    path: string;
    referrer: string;
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
    type: "page_view" as const,
    path: cleanPath(payload.path),
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
