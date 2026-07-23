import "server-only";
import sharp from "sharp";

const MIN_PREVIEW_WIDTH = 240;
const MAX_PREVIEW_WIDTH = 1920;

export function parseImagePreviewWidth(value: string | null) {
  if (!value) return null;
  const width = Number.parseInt(value, 10);
  if (!Number.isFinite(width)) return null;
  return Math.min(MAX_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, width));
}

export function cosImagePreviewQuery(width: number) {
  return `imageMogr2/thumbnail/${width}x>/format/webp/quality/85`;
}

export async function createImagePreview(buffer: Buffer, width: number) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width,
      height: width,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 85, effort: 3 })
    .toBuffer();
}
