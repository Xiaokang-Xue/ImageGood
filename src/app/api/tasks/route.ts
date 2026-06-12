import { NextResponse } from "next/server";
import { deleteUserTasks, listUserTasks } from "@/lib/server/image-task-service";
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

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后再删除历史记录" } },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { taskIds?: unknown };
  const taskIds = Array.isArray(payload.taskIds) ? payload.taskIds.filter((id): id is string => typeof id === "string") : [];

  if (taskIds.length === 0) {
    return NextResponse.json(
      { status: "failed", error: { code: "INVALID_TASK_IDS", message: "请选择要删除的历史记录" } },
      { status: 400 }
    );
  }

  const result = await deleteUserTasks(user.id, taskIds);
  return NextResponse.json({ ok: true, ...result });
}
