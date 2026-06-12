import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDbSnapshot } from "@/lib/db";
import { getCosObjectBuffer, isCosStorageEnabled, parseTaskInfoFromCosKey } from "@/lib/server/cos-storage";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function imageLooksValid(buffer: Buffer) {
  return (
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") ||
    buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
    buffer.subarray(0, 6).toString("ascii") === "GIF89a"
  );
}

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
  const mimeType = IMAGE_MIME_TYPES[extension];
  if (!mimeType) {
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }

  const db = await getDbSnapshot();
  const task = db.imageTasks.find((item) => item.id === taskInfo.taskId);
  if (!task || task.userId !== taskInfo.userId || (task.userId !== user.id && user.role !== "admin")) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问该图片" } }, { status: 403 });
  }

  try {
    const buffer = await getCosObjectBuffer(taskInfo.key);
    if (!imageLooksValid(buffer)) {
      return NextResponse.json({ error: { code: "INVALID_IMAGE", message: "图片文件不可用" } }, { status: 404 });
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }
}
