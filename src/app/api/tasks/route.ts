import { NextResponse } from "next/server";
import { listUserTasks } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后查看历史记录" } },
      { status: 401 }
    );
  }

  const tasks = await listUserTasks(user.id);
  return NextResponse.json({ ok: true, tasks });
}
