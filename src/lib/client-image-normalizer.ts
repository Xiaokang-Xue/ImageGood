"use client";

import {
  CONVERTIBLE_IMAGE_MIME_TYPES,
  DIRECT_IMAGE_MIME_TYPES,
  MAX_PROVIDER_IMAGE_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  PROVIDER_INPUT_IMAGE_MIME_TYPE,
  SUPPORTED_SOURCE_IMAGE_EXTENSIONS,
  formatImageByteLimit
} from "@/config/image-upload";

const DIRECT_UPLOAD_TYPES = new Set<string>(DIRECT_IMAGE_MIME_TYPES);
const CONVERTIBLE_UPLOAD_TYPES = new Set<string>(CONVERTIBLE_IMAGE_MIME_TYPES);
const IMAGE_EXTENSIONS = new Set<string>(SUPPORTED_SOURCE_IMAGE_EXTENSIONS);

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
  if (extension === ".heic") return "image/heic";
  if (extension === ".heif") return "image/heif";
  if (extension === ".avif") return "image/avif";
  if (extension === ".tif" || extension === ".tiff") return "image/tiff";
  if (extension === ".gif") return "image/gif";
  if (extension === ".bmp") return "image/bmp";
  return "";
}

function withCorrectedDeclaredMime(file: File) {
  const mime = declaredMimeFromExtension(fileExtension(file));
  if (!mime || file.type === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

export function shouldNormalizeImageFile(file: File) {
  return file.type !== PROVIDER_INPUT_IMAGE_MIME_TYPE || file.size > MAX_PROVIDER_IMAGE_BYTES;
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
    message.includes("图片预处理异常") ||
    message.toLowerCase().includes("invalid image file") ||
    message.toLowerCase().includes("image file or mode") ||
    message.toLowerCase().includes("unsupported image")
  );
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

  // Preserve the selected source bytes for preview and upload. The server performs
  // the authoritative HEIC decode and provider-safe PNG conversion before task creation.
  return withCorrectedDeclaredMime(file);
}
