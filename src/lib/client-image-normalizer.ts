"use client";

import {
  CONVERTIBLE_IMAGE_MIME_TYPES,
  DIRECT_IMAGE_MIME_TYPES,
  MAX_PROVIDER_IMAGE_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  SUPPORTED_SOURCE_IMAGE_EXTENSIONS,
  formatImageByteLimit
} from "@/config/image-upload";

const DIRECT_UPLOAD_TYPES = new Set<string>(DIRECT_IMAGE_MIME_TYPES);
const CONVERTIBLE_UPLOAD_TYPES = new Set<string>(CONVERTIBLE_IMAGE_MIME_TYPES);
const IMAGE_EXTENSIONS = new Set<string>(SUPPORTED_SOURCE_IMAGE_EXTENSIONS);
const JPEG_QUALITIES = [0.96, 0.92, 0.88, 0.84, 0.78];

export class ImageNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageNormalizationError";
  }
}

function fileExtension(file: File) {
  return file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

function declaredMimeFromExtension(extension: string) {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "";
}

function withCorrectedDeclaredMime(file: File) {
  const mime = declaredMimeFromExtension(fileExtension(file));
  if (!mime || file.type === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

export function shouldNormalizeImageFile(file: File) {
  return !DIRECT_UPLOAD_TYPES.has(file.type) || file.size > MAX_PROVIDER_IMAGE_BYTES;
}

export function isPotentialImageFile(file: File) {
  const extension = fileExtension(file);
  return DIRECT_UPLOAD_TYPES.has(file.type) || CONVERTIBLE_UPLOAD_TYPES.has(file.type) || IMAGE_EXTENSIONS.has(extension);
}

export function isImageCompatibilityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("无法识别图片") ||
    message.includes("图片格式转换失败") ||
    message.includes("无法读取图片") ||
    message.toLowerCase().includes("invalid image file") ||
    message.toLowerCase().includes("image file or mode") ||
    message.toLowerCase().includes("unsupported image")
  );
}

function outputName(inputName: string) {
  const baseName = inputName.replace(/\.[^.]+$/, "") || "imagegood-upload";
  return `${baseName}.jpg`;
}

async function decodeWithCreateImageBitmap(file: File) {
  if (typeof createImageBitmap !== "function") {
    throw new Error("createImageBitmap unavailable");
  }
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function decodeWithImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image decode failed"));
    };
    image.src = objectUrl;
  });
}

function closeDecodedImage(decoded: ImageBitmap | HTMLImageElement) {
  if ("close" in decoded && typeof decoded.close === "function") decoded.close();
}

function renderToCanvas(decoded: ImageBitmap | HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new ImageNormalizationError("当前浏览器无法预处理图片，系统将在提交时继续兼容处理");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(decoded, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas export failed"))),
      "image/jpeg",
      quality
    );
  });
}

async function bestJpegBlob(canvas: HTMLCanvasElement) {
  let lastBlob: Blob | null = null;
  for (const quality of JPEG_QUALITIES) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= MAX_PROVIDER_IMAGE_BYTES) return blob;
    lastBlob = blob;
  }
  return lastBlob;
}

async function convertToJpeg(file: File) {
  let decoded: ImageBitmap | HTMLImageElement | null = null;
  try {
    try {
      decoded = await decodeWithCreateImageBitmap(file);
    } catch {
      decoded = await decodeWithImageElement(file);
    }

    let width = decoded.width;
    let height = decoded.height;
    if (!width || !height) throw new Error("missing image dimensions");

    let canvas = renderToCanvas(decoded, width, height);
    let blob = await bestJpegBlob(canvas);

    for (let attempt = 0; blob && blob.size > MAX_PROVIDER_IMAGE_BYTES && attempt < 6; attempt += 1) {
      const scale = Math.max(0.35, Math.min(0.94, Math.sqrt((MAX_PROVIDER_IMAGE_BYTES * 0.96) / blob.size)));
      width = Math.max(1, Math.floor(width * scale));
      height = Math.max(1, Math.floor(height * scale));
      canvas = renderToCanvas(decoded, width, height);
      blob = await bestJpegBlob(canvas);
    }

    if (!blob || blob.size > MAX_PROVIDER_IMAGE_BYTES) {
      throw new ImageNormalizationError(
        `图片自动优化后仍超过 ${formatImageByteLimit(MAX_PROVIDER_IMAGE_BYTES)}，请更换文件后再试`
      );
    }

    return new File([blob], outputName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    if (decoded) closeDecodedImage(decoded);
  }
}

export async function prepareImageFileForUpload(file: File) {
  if (!isPotentialImageFile(file)) {
    throw new ImageNormalizationError(
      "请选择 JPEG、PNG、WebP、HEIC、HEIF、AVIF、TIFF、GIF 或 BMP 图片"
    );
  }
  if (file.size <= 0) throw new ImageNormalizationError("图片文件为空，请重新选择图片");
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new ImageNormalizationError(`原始图片不能超过 ${formatImageByteLimit(MAX_SOURCE_IMAGE_BYTES)}`);
  }

  const correctedFile = withCorrectedDeclaredMime(file);
  if (DIRECT_UPLOAD_TYPES.has(correctedFile.type) && correctedFile.size <= MAX_PROVIDER_IMAGE_BYTES) {
    return correctedFile;
  }

  // PNG/WebP may contain transparency. Let the mandatory server preflight preserve it.
  if (["image/png", "image/webp"].includes(correctedFile.type)) return correctedFile;

  try {
    return await convertToJpeg(correctedFile);
  } catch {
    // Browsers cannot reliably decode HEIC, TIFF and every camera color mode.
    // The server performs the authoritative conversion before creating a task.
    return correctedFile;
  }
}
