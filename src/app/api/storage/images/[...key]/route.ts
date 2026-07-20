import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getImageTaskById } from "@/lib/db";
import { getCosObjectBuffer, isCosStorageEnabled, parseTaskInfoFromCosKey } from "@/lib/server/cos-storage";
import { detectBrowserImageMimeType, imageMimeTypeFromExtension } from "@/lib/server/image-file";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  {
    params
  }: {
    params: {
      key?: string[];
    };
  }
) {
  if (!isCosStorageEnabled()) {
    return NextResponse.json({ error: { code: "STORAGE_NOT_ENABLED", message: "对象存储未启用" } }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }

  const key = (params.key || []).join("/");
  const taskInfo = parseTaskInfoFromCosKey(key);
  if (!taskInfo) {
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }

  const extension = path.extname(taskInfo.filename).toLowerCase();
  if (!imageMimeTypeFromExtension(extension)) {
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }

  const task = await getImageTaskById(taskInfo.taskId);
  if (!task || task.userId !== taskInfo.userId || (task.userId !== user.id && user.role !== "admin")) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问该图片" } }, { status: 403 });
  }

  try {
    const buffer = await getCosObjectBuffer(taskInfo.key);
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) {
      return NextResponse.json({ error: { code: "INVALID_IMAGE", message: "图片文件不可用" } }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(taskInfo.filename)}`,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie"
      }
    });
  } catch (error) {
    console.error("[storage-image] failed to read COS image", {
      taskId: taskInfo.taskId,
      filename: taskInfo.filename,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }
}
