import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { buildTaskObjectKey, isCosStorageEnabled, uploadBufferToCos } from "@/lib/server/cos-storage";
import { detectBrowserImageMimeType, imageExtensionFromMimeType } from "@/lib/server/image-file";
import type { ImageOutputFormat } from "@/types/image";

const MIME_TYPES: Record<ImageOutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

export function base64ToDataUrl(base64: string, outputFormat: ImageOutputFormat = "png") {
  return `data:${MIME_TYPES[outputFormat]};base64,${base64}`;
}

export function bytesToDataUrl(bytes: ArrayBuffer, mimeType = "image/png") {
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function envBoolean(value: string | undefined, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getCodexWorkDir() {
  return process.env.CODEX_IMAGE_API_WORKDIR || "/data/codex_image_api_runs";
}

const RESULT_DOWNLOAD_ATTEMPTS = 3;
const RESULT_DOWNLOAD_TIMEOUT_MS = 30_000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadRemoteResult(imageUrl: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RESULT_DOWNLOAD_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESULT_DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(imageUrl, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = detectBrowserImageMimeType(buffer);
      if (!mimeType) {
        throw new Error("unsupported image response");
      }

      return { buffer, mimeType };
    } catch (error) {
      lastError = error;
      if (attempt < RESULT_DOWNLOAD_ATTEMPTS) {
        await wait(250 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError || "unknown error");
  throw new Error(`生成结果保存失败：无法读取有效图片（${reason}）`);
}

function taskImageUrl(taskId: string, filename: string) {
  return `/api/task-images/${safePathSegment(taskId)}/${encodeURIComponent(filename)}`;
}

function codexTaskImageUrl(imagePath: string, taskId: string) {
  const safeTaskId = safePathSegment(taskId);
  if (!safeTaskId || !path.isAbsolute(imagePath)) return null;

  const taskDir = path.resolve(getCodexWorkDir(), "tasks", safeTaskId);
  const resolvedImagePath = path.resolve(imagePath);
  const relative = path.relative(taskDir, resolvedImagePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  const filename = path.basename(resolvedImagePath);
  if (!filename || filename.startsWith("reference_") || filename.startsWith("input.")) {
    return null;
  }

  return taskImageUrl(safeTaskId, filename);
}

export async function saveUploadFile(file: File, userId: string, taskId: string) {
  const extension = imageExtensionFromMimeType(file.type || "image/png");
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isCosStorageEnabled()) {
    const uploaded = await uploadBufferToCos({
      key: buildTaskObjectKey({
        userId,
        taskId,
        filename: `input.${extension}`
      }),
      body: buffer,
      contentType: file.type || MIME_TYPES.png
    });
    return uploaded.url;
  }

  const relativePath = `/generated/${safePathSegment(userId)}/${safePathSegment(taskId)}/input.${extension}`;
  const absolutePath = path.join(process.cwd(), "public", relativePath.slice(1));

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return relativePath;
}

export async function saveResultImage(imageUrl: string, userId: string, taskId: string, index = 1) {
  const cosEnabled = isCosStorageEnabled();

  if (imageUrl.startsWith("/api/storage/images/")) {
    return imageUrl;
  }

  if (!cosEnabled && imageUrl.startsWith("/generated/")) {
    return imageUrl;
  }

  if (!cosEnabled) {
    if (imageUrl.startsWith("/api/task-images/")) {
      return imageUrl;
    }

    const codexUrl = codexTaskImageUrl(imageUrl, taskId);
    if (codexUrl) {
      try {
        const buffer = await readFile(imageUrl);
        const mimeType = detectBrowserImageMimeType(buffer);
        return mimeType ? codexUrl : "";
      } catch {
        return "";
      }
    }
  }

  let mimeType = "image/png";
  let buffer: Buffer;

  const parsed = parseDataUrl(imageUrl);
  if (parsed) {
    buffer = parsed.buffer;
    mimeType = detectBrowserImageMimeType(buffer) || parsed.mimeType;
  } else if (cosEnabled && imageUrl.startsWith("/generated/")) {
    try {
      const absolutePath = path.join(process.cwd(), "public", imageUrl.slice(1));
      buffer = await readFile(absolutePath);
      mimeType = detectBrowserImageMimeType(buffer) || "";
      if (!mimeType) throw new Error("生成结果不是有效图片");
    } catch {
      return "";
    }
  } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const downloaded = await downloadRemoteResult(imageUrl);
    mimeType = downloaded.mimeType;
    buffer = downloaded.buffer;
  } else if (path.isAbsolute(imageUrl)) {
    if (cosEnabled && !codexTaskImageUrl(imageUrl, taskId)) {
      return "";
    }
    try {
      buffer = await readFile(imageUrl);
      mimeType = detectBrowserImageMimeType(buffer) || "";
      if (!mimeType) return "";
    } catch {
      return "";
    }
  } else {
    return imageUrl;
  }

  const detectedMimeType = detectBrowserImageMimeType(buffer);
  if (!detectedMimeType) {
    throw new Error("生成结果不是浏览器支持的有效图片");
  }
  mimeType = detectedMimeType;

  const extension = imageExtensionFromMimeType(mimeType);
  const filename = index === 1 ? `result.${extension}` : `result-${index}.${extension}`;

  if (cosEnabled) {
    const uploaded = await uploadBufferToCos({
      key: buildTaskObjectKey({
        userId,
        taskId,
        filename
      }),
      body: buffer,
      contentType: mimeType || MIME_TYPES.png
    });
    return uploaded.url;
  }

  const relativePath = `/generated/${safePathSegment(userId)}/${safePathSegment(taskId)}/${filename}`;
  const absolutePath = path.join(process.cwd(), "public", relativePath.slice(1));

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return relativePath;
}

export async function normalizeResultImages(imageUrls: string[], userId: string, taskId: string) {
  const saved = await Promise.all(imageUrls.map((url, index) => saveResultImage(url, userId, taskId, index + 1)));
  return saved.filter(Boolean);
}

export async function cleanupLocalTaskDirectoryAfterUpload(taskId: string) {
  if (!isCosStorageEnabled() || !envBoolean(process.env.TENCENT_COS_CLEAN_LOCAL_TASK_DIR)) {
    return;
  }

  const safeTaskId = safePathSegment(taskId);
  if (!safeTaskId) return;

  const tasksDir = path.resolve(getCodexWorkDir(), "tasks");
  const taskDir = path.resolve(tasksDir, safeTaskId);
  const relative = path.relative(tasksDir, taskDir);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return;
  }

  try {
    await rm(taskDir, { recursive: true, force: true });
  } catch (error) {
    console.warn("[image-storage] failed to cleanup local task directory", {
      taskId: safeTaskId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function saveBase64Image(input: { base64: string; outputFormat?: ImageOutputFormat }) {
  return base64ToDataUrl(input.base64, input.outputFormat);
}
