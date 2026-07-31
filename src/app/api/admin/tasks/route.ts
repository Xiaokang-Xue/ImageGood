import { NextResponse } from "next/server";
import { getAdminImageTaskPage } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { ImageTaskStatus, ImageTaskType } from "@/types/task";

export const runtime = "nodejs";

const TASK_TYPES = new Set<ImageTaskType>([
  "edit",
  "product",
  "poster",
  "text_to_image",
  "remove_background",
  "image_enhance",
  "object_remove"
]);
const TASK_STATUSES = new Set<ImageTaskStatus>([
  "pending",
  "processing",
  "succeeded",
  "failed"
]);

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 }
    );
  }
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "没有管理员权限" } },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "all";
  const status = url.searchParams.get("status") || "all";
  const query = (url.searchParams.get("query") || "").trim().slice(0, 120);

  const result = await getAdminImageTaskPage({
    page: Number(url.searchParams.get("page") || "1"),
    limit: Number(url.searchParams.get("limit") || "10"),
    query,
    type: TASK_TYPES.has(type as ImageTaskType) ? (type as ImageTaskType) : "all",
    status: TASK_STATUSES.has(status as ImageTaskStatus)
      ? (status as ImageTaskStatus)
      : "all"
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
