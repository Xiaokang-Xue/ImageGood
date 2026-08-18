import { NextResponse } from "next/server";
import { getAdminFeedbackPage } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { FeedbackStatus, FeedbackType } from "@/types/feedback";

export const runtime = "nodejs";

const TYPES = new Set<FeedbackType>(["suggestion", "report", "problem"]);
const STATUSES = new Set<FeedbackStatus>(["pending", "reviewing", "resolved", "closed"]);

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "没有管理员权限" } }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "all";
  const status = url.searchParams.get("status") || "all";
  const result = await getAdminFeedbackPage({
    page: Number(url.searchParams.get("page") || "1"),
    limit: Number(url.searchParams.get("limit") || "12"),
    type: TYPES.has(type as FeedbackType) ? (type as FeedbackType) : "all",
    status: STATUSES.has(status as FeedbackStatus) ? (status as FeedbackStatus) : "all"
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
