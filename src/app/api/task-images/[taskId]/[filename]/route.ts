import { readFile, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getImageTaskById } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function getCodexWorkDir() {
  return process.env.CODEX_IMAGE_API_WORKDIR || "/data/codex_image_api_runs";
}

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
      taskId: string;
      filename: string;
    };
  }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }

  const taskId = safePathSegment(params.taskId);
  const filename = path.basename(params.filename || "");
  const extension = path.extname(filename).toLowerCase();

  if (!taskId || !filename || filename.startsWith("reference_") || filename.startsWith("input.") || !IMAGE_MIME_TYPES[extension]) {
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }

  const task = await getImageTaskById(taskId);
  if (!task || (task.userId !== user.id && user.role !== "admin")) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问该图片" } }, { status: 403 });
  }

  const taskDir = path.resolve(getCodexWorkDir(), "tasks", taskId);
  const imagePath = path.resolve(taskDir, filename);
  const relative = path.relative(taskDir, imagePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }

  try {
    const fileStat = await stat(imagePath);
    if (!fileStat.isFile() || fileStat.size <= 0) {
      return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
    }

    const buffer = await readFile(imagePath);
    if (!imageLooksValid(buffer)) {
      return NextResponse.json({ error: { code: "INVALID_IMAGE", message: "图片文件不可用" } }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": IMAGE_MIME_TYPES[extension],
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }
}
