import { NextResponse } from "next/server";
import { deleteUserTask, getUserTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
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
  } catch (error) {
    console.error("[tasks] failed to read task", {
      taskId: params.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { status: "failed", error: { code: "TASK_READ_FAILED", message: "任务信息读取失败，请稍后重试" } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后再删除历史记录" } },
        { status: 401 }
      );
    }

    const result = await deleteUserTask(user.id, params.id);
    if (!result.deleted) {
      if (result.reason === "in_progress") {
        return NextResponse.json(
          { status: "failed", error: { code: "TASK_IN_PROGRESS", message: "生成中的任务暂不能删除，请完成后再试" } },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { status: "failed", error: { code: "TASK_NOT_FOUND", message: "记录不存在或无权访问" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deletedId: result.id });
  } catch (error) {
    console.error("[tasks] failed to delete task", {
      taskId: params.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { status: "failed", error: { code: "TASK_DELETE_FAILED", message: "历史记录删除失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
