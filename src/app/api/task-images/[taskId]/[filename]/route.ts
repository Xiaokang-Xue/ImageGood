import { readFile, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getImageTaskById } from "@/lib/db";
import { detectBrowserImageMimeType, imageMimeTypeFromExtension } from "@/lib/server/image-file";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function getCodexWorkDir() {
  return process.env.CODEX_IMAGE_API_WORKDIR || "/data/codex_image_api_runs";
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

  if (!taskId || !filename || filename.startsWith("reference_") || filename.startsWith("input.") || !imageMimeTypeFromExtension(extension)) {
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
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) {
      return NextResponse.json({ error: { code: "INVALID_IMAGE", message: "图片文件不可用" } }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie"
      }
    });
  } catch (error) {
    console.error("[task-image] failed to read local image", {
      taskId,
      filename,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: { code: "IMAGE_NOT_FOUND", message: "图片不存在" } }, { status: 404 });
  }
}
