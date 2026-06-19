import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDailyAnalyticsReport } from "@/lib/server/analytics/daily-analytics";
import { formatFeishuDailyReport } from "@/lib/server/analytics/format-feishu-daily-report";
import { sendFeishuTextMessage } from "@/lib/server/feishu/feishu-bot";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权限访问" } }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<{
    date: string;
    range: "today" | "yesterday";
  }>;

  try {
    const report = await getDailyAnalyticsReport({
      date: body.date,
      range: body.range
    });
    await sendFeishuTextMessage(formatFeishuDailyReport(report));
    return NextResponse.json({ ok: true, date: report.date, range: report.range });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "FEISHU_REPORT_FAILED",
          message: error instanceof Error ? error.message : "飞书日报发送失败"
        }
      },
      { status: 500 }
    );
  }
}
