import { NextResponse } from "next/server";
import { getUserTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后查看历史记录" } },
      { status: 401 }
    );
  }

  const task = await getUserTask(user.id, params.id);

  if (!task) {
    return NextResponse.json(
      { status: "failed", error: { code: "TASK_NOT_FOUND", message: "记录不存在或无权访问" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, task });
}
