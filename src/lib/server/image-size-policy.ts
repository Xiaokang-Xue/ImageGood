import "server-only";

import sharp from "sharp";
import type { ImageSize } from "@/types/image";

type ExplicitImageSize = Exclude<ImageSize, "auto">;

const SQUARE_RATIO_PATTERN = /(?:^|[^\d])1\s*[:：xX×/]\s*1(?:[^\d]|$)/;
const PORTRAIT_RATIO_PATTERN = /(?:^|[^\d])(?:2\s*[:：xX×/]\s*3|3\s*[:：xX×/]\s*4|4\s*[:：xX×/]\s*5|9\s*[:：xX×/]\s*16)(?:[^\d]|$)/;
const LANDSCAPE_RATIO_PATTERN = /(?:^|[^\d])(?:3\s*[:：xX×/]\s*2|4\s*[:：xX×/]\s*3|16\s*[:：xX×/]\s*9)(?:[^\d]|$)/;

const SQUARE_WORD_PATTERN = /正方形|方形构图|方图|square\b/i;
const PORTRAIT_WORD_PATTERN = /竖版|竖向|竖屏|纵向|手机壁纸|portrait\b|vertical\b/i;
const LANDSCAPE_WORD_PATTERN = /横版|横向|横屏|宽幅|全景|banner\b|landscape\b|horizontal\b|widescreen\b/i;

export function inferImageSizeFromPrompt(prompt?: string): ExplicitImageSize | null {
  const value = prompt?.trim();
  if (!value) return null;

  if (SQUARE_RATIO_PATTERN.test(value) || SQUARE_WORD_PATTERN.test(value)) return "1024x1024";
  if (PORTRAIT_RATIO_PATTERN.test(value) || PORTRAIT_WORD_PATTERN.test(value)) return "1024x1536";
  if (LANDSCAPE_RATIO_PATTERN.test(value) || LANDSCAPE_WORD_PATTERN.test(value)) return "1536x1024";
  return null;
}

export function imageSizeFromDimensions(width?: number, height?: number): ExplicitImageSize {
  if (!width || !height) return "1024x1024";

  const ratio = width / height;
  if (ratio >= 1.12) return "1536x1024";
  if (ratio <= 1 / 1.12) return "1024x1536";
  return "1024x1024";
}

export async function resolveInputImageSize(input: {
  image: File;
  prompt?: string;
  requestedSize?: ImageSize;
}) {
  const promptSize = inferImageSizeFromPrompt(input.prompt);
  if (promptSize) return promptSize;

  // Portrait and landscape values can only come from an explicit caller choice.
  // Treat the old square default as legacy input so cached clients still preserve
  // the uploaded image orientation after this server-side fix is deployed.
  if (input.requestedSize === "1024x1536" || input.requestedSize === "1536x1024") {
    return input.requestedSize;
  }

  try {
    const metadata = await sharp(Buffer.from(await input.image.arrayBuffer()), {
      animated: false,
      failOn: "none"
    }).metadata();
    return imageSizeFromDimensions(metadata.width, metadata.height);
  } catch {
    return "1024x1024";
  }
}

export function resolveGeneratedImageSize(input: {
  prompt?: string;
  requestedSize?: ImageSize;
  fallback?: ExplicitImageSize;
}) {
  return (
    inferImageSizeFromPrompt(input.prompt) ||
    (input.requestedSize && input.requestedSize !== "auto" ? input.requestedSize : null) ||
    input.fallback ||
    "1024x1024"
  );
}

export function appendImageSizeGuidance(prompt: string, size: ImageSize) {
  const guidance: Partial<Record<ImageSize, string>> = {
    "1024x1024": "输出采用方形构图，完整保留关键主体，不裁切重要内容。",
    "1024x1536": "输出采用竖向构图，合理延展画面，完整保留关键主体。",
    "1536x1024": "输出采用横向构图，合理延展画面，完整保留关键主体。"
  };
  const line = guidance[size];
  return line ? `${prompt}\n构图要求：${line}` : prompt;
}
