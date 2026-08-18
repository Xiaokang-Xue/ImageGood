import { NextResponse } from "next/server";
import { createFeedbackEntry } from "@/lib/db";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import type { FeedbackType } from "@/types/feedback";

export const runtime = "nodejs";

const FEEDBACK_TYPES = new Set<FeedbackType>(["suggestion", "report", "problem"]);

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    assertRateLimit(`feedback:${user?.id || clientIp(request)}`, 5, 10 * 60_000);
    const body = (await request.json()) as Partial<{
      type: FeedbackType;
      content: string;
      contact: string;
      pageUrl: string;
      taskId: string;
    }>;
    const type = FEEDBACK_TYPES.has(body.type as FeedbackType) ? (body.type as FeedbackType) : null;
    const content = String(body.content || "").trim();
    const contact = String(body.contact || "").trim().slice(0, 120);
    const pageUrl = String(body.pageUrl || "").trim().slice(0, 500);
    const taskId = String(body.taskId || "").trim().slice(0, 100);

    if (!type) {
      return NextResponse.json({ error: { code: "INVALID_FEEDBACK_TYPE", message: "请选择反馈类型" } }, { status: 400 });
    }
    if (content.length < 10 || content.length > 2000) {
      return NextResponse.json(
        { error: { code: "INVALID_FEEDBACK_CONTENT", message: "请填写 10–2000 个字的具体说明" } },
        { status: 400 }
      );
    }

    const entry = await createFeedbackEntry({
      userId: user?.id ?? null,
      type,
      content,
      contact: contact || null,
      pageUrl: pageUrl || null,
      taskId: taskId || null
    });
    return NextResponse.json({ ok: true, id: entry.id, message: "反馈已提交，感谢你的帮助" });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: { code: "FEEDBACK_RATE_LIMITED", message: "提交较为频繁，请稍后再试" } },
        { status: 429 }
      );
    }
    console.error("[feedback] create failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: { code: "FEEDBACK_CREATE_FAILED", message: "反馈提交失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
