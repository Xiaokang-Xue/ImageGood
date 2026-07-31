import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  buildTaskObjectKey,
  cosObjectUrl,
  getCosObjectBuffer,
  isCosStorageEnabled,
  uploadBufferToCos
} from "@/lib/server/cos-storage";
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

const PRIVATE_RESULT_PREFIX = "imagegood-private:";

function envBoolean(value: string | undefined, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getCodexWorkDir() {
  return process.env.CODEX_IMAGE_API_WORKDIR || "/data/codex_image_api_runs";
}

function decodeStorageProxyKey(imageUrl: string) {
  const pathname = imageUrl.split("#")[0].split("?")[0];
  const prefix = "/api/storage/images/";
  if (!pathname.startsWith(prefix)) return "";
  try {
    return pathname
      .slice(prefix.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return "";
  }
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

async function loadResultImageBuffer(imageUrl: string, taskId: string) {
  const parsed = parseDataUrl(imageUrl);
  if (parsed) {
    const mimeType = detectBrowserImageMimeType(parsed.buffer);
    if (!mimeType) throw new Error("生成结果不是有效图片");
    return { buffer: parsed.buffer, mimeType };
  }

  const storageKey = decodeStorageProxyKey(imageUrl);
  if (storageKey && isCosStorageEnabled()) {
    const buffer = await getCosObjectBuffer(storageKey);
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) throw new Error("生成结果不是有效图片");
    return { buffer, mimeType };
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return downloadRemoteResult(imageUrl);
  }

  if (imageUrl.startsWith("/api/task-images/")) {
    const pathname = imageUrl.split("#")[0].split("?")[0];
    const parts = pathname.split("/").filter(Boolean);
    const sourceTaskId = safePathSegment(parts[2] || "");
    const filename = path.basename(decodeURIComponent(parts.slice(3).join("/")));
    if (!sourceTaskId || sourceTaskId !== safePathSegment(taskId) || !filename) {
      throw new Error("生成结果路径无效");
    }
    const buffer = await readFile(path.join(getCodexWorkDir(), "tasks", sourceTaskId, filename));
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) throw new Error("生成结果不是有效图片");
    return { buffer, mimeType };
  }

  if (imageUrl.startsWith("/generated/")) {
    const pathname = imageUrl.split("#")[0].split("?")[0];
    const absolutePath = path.join(process.cwd(), "public", pathname.replace(/^\/+/, ""));
    const buffer = await readFile(absolutePath);
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) throw new Error("生成结果不是有效图片");
    return { buffer, mimeType };
  }

  if (path.isAbsolute(imageUrl)) {
    const buffer = await readFile(imageUrl);
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) throw new Error("生成结果不是有效图片");
    return { buffer, mimeType };
  }

  if (imageUrl.startsWith("/")) {
    const pathname = imageUrl.split("#")[0].split("?")[0];
    const absolutePath = path.join(process.cwd(), "public", pathname.replace(/^\/+/, ""));
    const buffer = await readFile(absolutePath);
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) throw new Error("生成结果不是有效图片");
    return { buffer, mimeType };
  }

  throw new Error("无法读取生成结果");
}

async function savePublicResultBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  userId: string;
  taskId: string;
  filename: string;
}) {
  if (isCosStorageEnabled()) {
    const uploaded = await uploadBufferToCos({
      key: buildTaskObjectKey({
        userId: input.userId,
        taskId: input.taskId,
        filename: input.filename
      }),
      body: input.buffer,
      contentType: input.mimeType
    });
    return uploaded.url;
  }

  const relativePath = `/generated/${safePathSegment(input.userId)}/${safePathSegment(input.taskId)}/${input.filename}`;
  const absolutePath = path.join(process.cwd(), "public", relativePath.slice(1));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);
  return relativePath;
}

async function savePrivateResultBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  userId: string;
  taskId: string;
}) {
  const extension = imageExtensionFromMimeType(input.mimeType);
  const filename = `original-${randomUUID()}.${extension}`;

  if (isCosStorageEnabled()) {
    const key = buildTaskObjectKey({
      userId: input.userId,
      taskId: input.taskId,
      filename
    });
    await uploadBufferToCos({
      key,
      body: input.buffer,
      contentType: input.mimeType
    });
    return `${PRIVATE_RESULT_PREFIX}cos:${key}`;
  }

  const relativePath = [
    safePathSegment(input.userId),
    safePathSegment(input.taskId),
    filename
  ].join("/");
  const privateRoot = path.resolve(getCodexWorkDir(), "private-results");
  const absolutePath = path.resolve(privateRoot, relativePath);
  const relativeToRoot = path.relative(privateRoot, absolutePath);
  if (!relativeToRoot || relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("无水印结果保存路径无效");
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);
  return `${PRIVATE_RESULT_PREFIX}local:${relativePath.replace(/\\/g, "/")}`;
}

export async function readPrivateResultImage(reference: string) {
  if (!reference.startsWith(PRIVATE_RESULT_PREFIX)) {
    throw new Error("无水印结果引用无效");
  }

  const value = reference.slice(PRIVATE_RESULT_PREFIX.length);
  if (value.startsWith("cos:")) {
    const key = value.slice(4);
    const buffer = await getCosObjectBuffer(key);
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) throw new Error("无水印结果不可用");
    return { buffer, mimeType };
  }

  if (value.startsWith("local:")) {
    const privateRoot = path.resolve(getCodexWorkDir(), "private-results");
    const relativePath = value.slice(6);
    const absolutePath = path.resolve(privateRoot, relativePath);
    const relativeToRoot = path.relative(privateRoot, absolutePath);
    if (!relativeToRoot || relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new Error("无水印结果路径无效");
    }
    const buffer = await readFile(absolutePath);
    const mimeType = detectBrowserImageMimeType(buffer);
    if (!mimeType) throw new Error("无水印结果不可用");
    return { buffer, mimeType };
  }

  throw new Error("无水印结果引用无效");
}

export async function readStoredTaskImage(reference: string, taskId: string) {
  if (reference.startsWith(PRIVATE_RESULT_PREFIX)) {
    return readPrivateResultImage(reference);
  }
  return loadResultImageBuffer(reference, taskId);
}

async function createTrialWatermark(buffer: Buffer) {
  const image = sharp(buffer, { failOn: "warning" }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  const shortestSide = Math.max(320, Math.min(width, height));
  const fontSize = Math.max(22, Math.min(52, Math.round(shortestSide * 0.055)));
  const patternWidth = Math.round(fontSize * 7.2);
  const patternHeight = Math.round(fontSize * 4.2);
  const badgeWidth = Math.min(width - 32, Math.round(fontSize * 8.5));
  const badgeHeight = Math.round(fontSize * 1.9);
  const badgeX = Math.round((width - badgeWidth) / 2);
  const badgeY = Math.max(16, height - badgeHeight - Math.round(fontSize * 0.8));
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" width="${patternWidth}" height="${patternHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
          <text x="${Math.round(fontSize * 0.35)}" y="${Math.round(fontSize * 1.8)}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="1" fill="white" fill-opacity="0.26" stroke="black" stroke-opacity="0.12" stroke-width="1">ImageGood</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)"/>
      <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="black" fill-opacity="0.62"/>
      <text x="${Math.round(width / 2)}" y="${Math.round(badgeY + badgeHeight * 0.64)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.72)}" font-weight="700" letter-spacing="1" fill="white">ImageGood FREE PREVIEW</text>
    </svg>`
  );

  return image
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function saveTrialResultImages(
  imageUrls: string[],
  userId: string,
  taskId: string
) {
  const saved = await Promise.all(
    imageUrls.map(async (imageUrl, index) => {
      const source = await loadResultImageBuffer(imageUrl, taskId);
      const originalReference = await savePrivateResultBuffer({
        ...source,
        userId,
        taskId
      });
      const watermarkedBuffer = await createTrialWatermark(source.buffer);
      const filename = index === 0 ? "result.png" : `result-${index + 1}.png`;
      const previewUrl = await savePublicResultBuffer({
        buffer: watermarkedBuffer,
        mimeType: "image/png",
        userId,
        taskId,
        filename
      });
      return { previewUrl, originalReference };
    })
  );

  return {
    resultImages: saved.map((item) => item.previewUrl),
    resultImageUrl: saved[0]?.previewUrl ?? null,
    originalResultImages: saved.map((item) => item.originalReference)
  };
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

export async function findSavedTaskResult(userId: string, taskId: string) {
  const filenames = ["result.png", "result.webp", "result.jpg", "result.jpeg"];

  if (isCosStorageEnabled()) {
    for (const filename of filenames) {
      const key = buildTaskObjectKey({ userId, taskId, filename });
      try {
        const buffer = await getCosObjectBuffer(key);
        if (detectBrowserImageMimeType(buffer)) return cosObjectUrl(key);
      } catch {
        // The next supported output extension may exist.
      }
    }
    return null;
  }

  for (const filename of filenames) {
    const relativePath = `/generated/${safePathSegment(userId)}/${safePathSegment(taskId)}/${filename}`;
    try {
      const buffer = await readFile(path.join(process.cwd(), "public", relativePath.slice(1)));
      if (detectBrowserImageMimeType(buffer)) return relativePath;
    } catch {
      // The next supported output extension may exist.
    }
  }

  return null;
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
