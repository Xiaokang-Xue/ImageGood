import { NextResponse } from "next/server";
import {
  deleteUserTask,
  getUserTask,
  updateUserTaskMetadata
} from "@/lib/server/image-task-service";
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后管理历史记录" } },
        { status: 401 }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      isFavorite?: unknown;
    };
    const update: { title?: string | null; isFavorite?: boolean } = {};
    if (payload.title !== undefined) {
      if (typeof payload.title !== "string" || payload.title.trim().length > 60) {
        return NextResponse.json(
          { status: "failed", error: { code: "INVALID_TITLE", message: "名称应为 1 至 60 个字符" } },
          { status: 400 }
        );
      }
      update.title = payload.title.trim() || null;
    }
    if (payload.isFavorite !== undefined) {
      if (typeof payload.isFavorite !== "boolean") {
        return NextResponse.json(
          { status: "failed", error: { code: "INVALID_FAVORITE", message: "收藏状态无效" } },
          { status: 400 }
        );
      }
      update.isFavorite = payload.isFavorite;
    }
    if (update.title === undefined && update.isFavorite === undefined) {
      return NextResponse.json(
        { status: "failed", error: { code: "EMPTY_UPDATE", message: "没有需要保存的修改" } },
        { status: 400 }
      );
    }

    const task = await updateUserTaskMetadata(user.id, params.id, update);
    if (!task) {
      return NextResponse.json(
        { status: "failed", error: { code: "TASK_NOT_FOUND", message: "记录不存在或无权访问" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    console.error("[tasks] failed to update task metadata", {
      taskId: params.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { status: "failed", error: { code: "TASK_UPDATE_FAILED", message: "历史记录保存失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
