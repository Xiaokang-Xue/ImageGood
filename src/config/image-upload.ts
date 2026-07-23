export const MAX_SOURCE_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_PROVIDER_IMAGE_BYTES = 10 * 1024 * 1024;
export const PROVIDER_INPUT_IMAGE_FORMAT = "png" as const;
export const PROVIDER_INPUT_IMAGE_MIME_TYPE = "image/png";

export const DIRECT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const CONVERTIBLE_IMAGE_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/avif",
  "image/tiff",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp"
] as const;

export const SUPPORTED_SOURCE_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
  ".tif",
  ".tiff",
  ".gif",
  ".bmp"
] as const;

export const IMAGE_FILE_INPUT_ACCEPT = [
  "image/*",
  ...DIRECT_IMAGE_MIME_TYPES,
  ...CONVERTIBLE_IMAGE_MIME_TYPES,
  ...SUPPORTED_SOURCE_IMAGE_EXTENSIONS
].join(",");

export const IMAGE_UPLOAD_FORMAT_DESCRIPTION =
  "支持 JPEG、PNG、WebP；HEIC、HEIF、AVIF、TIFF、GIF、BMP 会在生成前自动转换";

export function formatImageByteLimit(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}
