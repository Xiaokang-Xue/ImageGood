import "server-only";

export type BrowserImageMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

const MIME_TYPES_BY_EXTENSION: Record<string, BrowserImageMimeType> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

export function imageMimeTypeFromExtension(extension: string) {
  return MIME_TYPES_BY_EXTENSION[extension.toLowerCase()] ?? null;
}

export function detectBrowserImageMimeType(buffer: Buffer): BrowserImageMimeType | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") {
      return "image/gif";
    }
  }

  return null;
}

export function imageExtensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase().split(";", 1)[0].trim();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  return "png";
}
