import { NextResponse } from "next/server";
import { deleteUserTasks, listUserTasks } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";
import type { ImageTaskStatus, ImageTaskTimeRange, ImageTaskType } from "@/types/task";

export const runtime = "nodejs";

const taskTypes = new Set<ImageTaskType>([
  "edit",
  "product",
  "poster",
  "text_to_image",
  "remove_background",
  "image_enhance",
  "object_remove"
]);
const taskStatuses = new Set<ImageTaskStatus>(["pending", "processing", "succeeded", "failed"]);
const timeRanges = new Set<ImageTaskTimeRange>(["all", "today", "7d", "30d"]);

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后查看历史记录" } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "12");
  const rawType = url.searchParams.get("type");
  const rawStatus = url.searchParams.get("status");
  const rawTimeRange = url.searchParams.get("timeRange");
  const type = rawType && taskTypes.has(rawType as ImageTaskType) ? (rawType as ImageTaskType) : "all";
  const status =
    rawStatus && taskStatuses.has(rawStatus as ImageTaskStatus) ? (rawStatus as ImageTaskStatus) : "all";
  const timeRange =
    rawTimeRange && timeRanges.has(rawTimeRange as ImageTaskTimeRange)
      ? (rawTimeRange as ImageTaskTimeRange)
      : "all";
  const result = await listUserTasks(user.id, {
    page,
    limit,
    type,
    status,
    timeRange,
    favorite: url.searchParams.get("favorite") === "1"
  });
  return NextResponse.json(
    {
      ok: true,
      ...result,
      tasks: result.tasks.map((task) => ({
        ...task,
        prompt: task.prompt.slice(0, 500),
        resultImages: task.resultImages?.slice(0, 1) ?? []
      }))
    },
    {
      headers: { "Cache-Control": "private, no-store" }
    }
  );
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
