import type { EditTool, ImageOutputFormat, ImageQuality, ImageSize } from "@/types/image";
import { ImageInputNormalizationError, normalizeImageInputFile } from "@/lib/server/image-input-normalizer";
const SUPPORTED_TOOLS = new Set<EditTool>(["background", "remove", "enhance", "style", "expand", "custom"]);
const SUPPORTED_QUALITIES = new Set<ImageQuality>(["low", "medium", "high", "auto"]);
const SUPPORTED_OUTPUT_FORMATS = new Set<ImageOutputFormat>(["png", "jpeg", "webp"]);
const SUPPORTED_IMAGE_SIZES = new Set<ImageSize>(["1024x1024", "1024x1536", "1536x1024", "auto"]);

export class ImageRequestError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ImageRequestError";
    this.code = code;
    this.status = status;
  }
}

export function getFormString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value : fallback;
}

export async function getRequiredImageFile(formData: FormData) {
  const value = formData.get("image");

  if (!(value instanceof File)) {
    throw new ImageRequestError("IMAGE_REQUIRED", "请先上传一张图片");
  }

  return validateImageFile(value);
}

export async function validateImageFile(file: File) {
  try {
    return await normalizeImageInputFile(file);
  } catch (error) {
    if (error instanceof ImageInputNormalizationError) {
      throw new ImageRequestError(error.code, error.message, error.status);
    }
    throw error;
  }
}

export function normalizeEditTool(value?: string): EditTool {
  if (value && SUPPORTED_TOOLS.has(value as EditTool)) {
    return value as EditTool;
  }

  return "custom";
}

export function normalizeImageQuality(value?: string): ImageQuality {
  if (value && SUPPORTED_QUALITIES.has(value as ImageQuality)) {
    return value as ImageQuality;
  }

  return "auto";
}

export function normalizeOutputFormat(value?: string): ImageOutputFormat {
  if (value && SUPPORTED_OUTPUT_FORMATS.has(value as ImageOutputFormat)) {
    return value as ImageOutputFormat;
  }

  return "png";
}

export function normalizeImageSize(value?: string): ImageSize {
  if (value && SUPPORTED_IMAGE_SIZES.has(value as ImageSize)) {
    return value as ImageSize;
  }

  return "1024x1024";
}
