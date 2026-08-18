import { NextResponse } from "next/server";
import { updateFeedbackStatus } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { FeedbackStatus } from "@/types/feedback";

export const runtime = "nodejs";

const STATUSES = new Set<FeedbackStatus>(["pending", "reviewing", "resolved", "closed"]);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "没有管理员权限" } }, { status: 403 });
  }
  const body = (await request.json()) as { status?: FeedbackStatus };
  if (!body.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: { code: "INVALID_STATUS", message: "处理状态无效" } }, { status: 400 });
  }
  const entry = await updateFeedbackStatus(params.id, body.status);
  if (!entry) {
    return NextResponse.json({ error: { code: "FEEDBACK_NOT_FOUND", message: "反馈不存在" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true, feedback: entry });
}
