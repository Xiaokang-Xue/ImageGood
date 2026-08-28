import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  buildTaskObjectKey,
  cosObjectUrl,
  getCosObjectBuffer,
  getCosObjectSignedUrl,
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

export async function getPrivateResultSignedUrl(
  reference: string,
  options: { filename: string; inline?: boolean }
) {
  if (!reference.startsWith(PRIVATE_RESULT_PREFIX)) return null;
  const value = reference.slice(PRIVATE_RESULT_PREFIX.length);
  if (!value.startsWith("cos:") || !isCosStorageEnabled()) return null;

  const key = value.slice(4);
  const safeFilename = options.filename.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return getCosObjectSignedUrl(key, {
    "response-content-disposition": `${options.inline ? "inline" : "attachment"}; filename="${safeFilename}"`
  });
}

export async function readStoredTaskImage(reference: string, taskId: string) {
  if (reference.startsWith(PRIVATE_RESULT_PREFIX)) {
    return readPrivateResultImage(reference);
  }
  return loadResultImageBuffer(reference, taskId);
}

export async function createTrialWatermark(buffer: Buffer, seed: string) {
  const image = sharp(buffer, { failOn: "warning" }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  const shortestSide = Math.max(320, Math.min(width, height));
  const digest = createHash("sha256").update(seed).digest();
  const angle = -(17 + (digest[0] % 12));
  const fontSize = Math.max(26, Math.min(72, Math.round(shortestSide * 0.072)));
  const bandHeight = Math.max(62, Math.round(fontSize * 2.35));
  const bandY = Math.round((height - bandHeight) / 2 + ((digest[1] % 17) - 8) * (height * 0.004));
  const badgeFontSize = Math.max(12, Math.round(fontSize * 0.34));
  const badgeHeight = Math.max(30, Math.round(badgeFontSize * 2.35));
  const badgeWidth = Math.max(128, Math.min(Math.max(128, width - 24), Math.round(badgeFontSize * 12.8)));
  const marginX = Math.max(12, Math.round(width * (0.045 + (digest[2] % 6) * 0.006)));
  const firstBadgeY = Math.max(12, Math.round(height * (0.12 + (digest[3] % 8) * 0.012)));
  const secondBadgeY = Math.max(12, Math.min(height - badgeHeight - 12, Math.round(height * (0.76 + (digest[4] % 8) * 0.012))));
  const taskCode = digest.toString("hex").slice(0, 6).toUpperCase();
  const lineShift = Math.round(((digest[5] % 21) - 10) * (height * 0.0025));
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="M ${-Math.round(width * 0.08)} ${Math.round(height * 0.34) + lineShift} C ${Math.round(width * 0.22)} ${Math.round(height * 0.18)}, ${Math.round(width * 0.62)} ${Math.round(height * 0.56)}, ${Math.round(width * 1.08)} ${Math.round(height * 0.31)}" fill="none" stroke="black" stroke-opacity="0.11" stroke-width="5"/>
      <path d="M ${-Math.round(width * 0.08)} ${Math.round(height * 0.34) + lineShift} C ${Math.round(width * 0.22)} ${Math.round(height * 0.18)}, ${Math.round(width * 0.62)} ${Math.round(height * 0.56)}, ${Math.round(width * 1.08)} ${Math.round(height * 0.31)}" fill="none" stroke="white" stroke-opacity="0.18" stroke-width="2"/>
      <path d="M ${-Math.round(width * 0.08)} ${Math.round(height * 0.69) - lineShift} C ${Math.round(width * 0.28)} ${Math.round(height * 0.48)}, ${Math.round(width * 0.7)} ${Math.round(height * 0.86)}, ${Math.round(width * 1.08)} ${Math.round(height * 0.63)}" fill="none" stroke="black" stroke-opacity="0.10" stroke-width="4"/>
      <path d="M ${-Math.round(width * 0.08)} ${Math.round(height * 0.69) - lineShift} C ${Math.round(width * 0.28)} ${Math.round(height * 0.48)}, ${Math.round(width * 0.7)} ${Math.round(height * 0.86)}, ${Math.round(width * 1.08)} ${Math.round(height * 0.63)}" fill="none" stroke="white" stroke-opacity="0.16" stroke-width="1.5"/>
      <g transform="rotate(${angle} ${Math.round(width / 2)} ${Math.round(height / 2)})">
        <rect x="${-Math.round(width * 0.16)}" y="${bandY}" width="${Math.round(width * 1.32)}" height="${bandHeight}" rx="${Math.round(bandHeight * 0.18)}" fill="white" fill-opacity="0.075" stroke="black" stroke-opacity="0.09" stroke-width="2"/>
        <line x1="${-Math.round(width * 0.16)}" y1="${bandY + Math.round(bandHeight * 0.2)}" x2="${Math.round(width * 1.16)}" y2="${bandY + Math.round(bandHeight * 0.2)}" stroke="white" stroke-opacity="0.16" stroke-width="2"/>
        <line x1="${-Math.round(width * 0.16)}" y1="${bandY + Math.round(bandHeight * 0.8)}" x2="${Math.round(width * 1.16)}" y2="${bandY + Math.round(bandHeight * 0.8)}" stroke="black" stroke-opacity="0.09" stroke-width="2"/>
        <text x="${Math.round(width / 2)}" y="${Math.round(bandY + bandHeight * 0.64)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="${Math.max(1, Math.round(fontSize * 0.055))}" fill="white" fill-opacity="0.19" stroke="black" stroke-opacity="0.18" stroke-width="${Math.max(1, Math.round(fontSize * 0.025))}" paint-order="stroke">ImageGood Preview</text>
      </g>
      <g>
        <rect x="${marginX}" y="${firstBadgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="black" fill-opacity="0.46" stroke="white" stroke-opacity="0.28"/>
        <text x="${marginX + Math.round(badgeWidth / 2)}" y="${Math.round(firstBadgeY + badgeHeight * 0.64)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${badgeFontSize}" font-weight="700" letter-spacing="1" fill="white" fill-opacity="0.94">ImageGood · ${taskCode}</text>
        <rect x="${width - marginX - badgeWidth}" y="${secondBadgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="white" fill-opacity="0.44" stroke="black" stroke-opacity="0.22"/>
        <text x="${width - marginX - Math.round(badgeWidth / 2)}" y="${Math.round(secondBadgeY + badgeHeight * 0.64)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${badgeFontSize}" font-weight="700" letter-spacing="1" fill="black" fill-opacity="0.72">Preview · IG-${taskCode}</text>
      </g>
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
      const watermarkedBuffer = await createTrialWatermark(source.buffer, `${taskId}:${index}`);
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
