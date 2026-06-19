"use client";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".avif"]);
const JPEG_QUALITIES = [0.96, 0.92, 0.88, 0.84];

export class ImageNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageNormalizationError";
  }
}

export function shouldNormalizeImageFile(file: File) {
  return !SUPPORTED_UPLOAD_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES;
}

export function isPotentialImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  return IMAGE_EXTENSIONS.has(extension);
}

export function isImageCompatibilityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("上传图片无法被模型识别") ||
    message.includes("图片格式需要自动优化") ||
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
  if ("close" in decoded && typeof decoded.close === "function") {
    decoded.close();
  }
}

function renderToCanvas(decoded: ImageBitmap | HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new ImageNormalizationError("当前浏览器无法处理图片，请更换浏览器或重新上传");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(decoded, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("canvas export failed"));
      },
      "image/jpeg",
      quality
    );
  });
}

async function bestJpegBlob(canvas: HTMLCanvasElement) {
  let lastBlob: Blob | null = null;

  for (const quality of JPEG_QUALITIES) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= MAX_UPLOAD_BYTES) return blob;
    lastBlob = blob;
  }

  return lastBlob;
}

async function convertToJpeg(file: File) {
  let decoded: ImageBitmap | HTMLImageElement | null = null;
  try {
    decoded = await decodeWithCreateImageBitmap(file);
  } catch {
    try {
      decoded = await decodeWithImageElement(file);
    } catch {
      throw new ImageNormalizationError("图片格式自动处理失败，请更换图片后再试");
    }
  }

  try {
    if (!decoded) {
      throw new ImageNormalizationError("图片格式自动处理失败，请更换图片后再试");
    }

    let width = decoded.width;
    let height = decoded.height;
    if (!width || !height) {
      throw new ImageNormalizationError("无法读取图片尺寸，请更换图片后再试");
    }

    let canvas = renderToCanvas(decoded, width, height);
    let blob = await bestJpegBlob(canvas);

    while (blob && blob.size > MAX_UPLOAD_BYTES && width > 900 && height > 900) {
      const scale = Math.max(0.5, Math.min(0.95, Math.sqrt((MAX_UPLOAD_BYTES * 0.92) / blob.size)));
      width = Math.max(1, Math.floor(width * scale));
      height = Math.max(1, Math.floor(height * scale));
      canvas = renderToCanvas(decoded, width, height);
      blob = await bestJpegBlob(canvas);
    }

    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      throw new ImageNormalizationError("图片过大，自动压缩后仍超过 10MB，请选择更小的图片后再试");
    }

    return new File([blob], outputName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } finally {
    if (decoded) closeDecodedImage(decoded);
  }
}

export async function prepareImageFileForUpload(file: File) {
  if (!isPotentialImageFile(file)) {
    throw new ImageNormalizationError("请选择图片文件");
  }

  if (!shouldNormalizeImageFile(file)) {
    return file;
  }

  return convertToJpeg(file);
}

export async function forceNormalizeImageFileForUpload(file: File) {
  if (!isPotentialImageFile(file)) {
    throw new ImageNormalizationError("请选择图片文件");
  }

  return convertToJpeg(file);
}
