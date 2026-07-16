import "server-only";

import bmp from "bmp-js";
import sharp, { type Metadata } from "sharp";
import {
  DIRECT_IMAGE_MIME_TYPES,
  MAX_PROVIDER_IMAGE_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  formatImageByteLimit
} from "@/config/image-upload";

const PROVIDER_TARGET_BYTES = Math.floor(MAX_PROVIDER_IMAGE_BYTES * 0.96);
const DIRECT_MIME_TYPES = new Set<string>(DIRECT_IMAGE_MIME_TYPES);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);
const JPEG_QUALITIES = [96, 92, 88, 84, 78];
const WEBP_QUALITIES = [96, 92, 88, 84, 78];

type NormalizedFormat = "jpeg" | "png" | "webp";

interface EncodedImage {
  buffer: Buffer;
  format: NormalizedFormat;
}

export class ImageInputNormalizationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ImageInputNormalizationError";
    this.code = code;
    this.status = status;
  }
}

function extensionOf(filename: string) {
  return filename.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

function baseNameOf(filename: string) {
  const baseName = filename.replace(/\.[^.]+$/, "").trim();
  return baseName || "imagegood-upload";
}

function mimeForFormat(format: NormalizedFormat) {
  if (format === "jpeg") return "image/jpeg";
  return `image/${format}`;
}

function extensionForFormat(format: NormalizedFormat) {
  return format === "jpeg" ? ".jpg" : `.${format}`;
}

function expectedExtensions(format: NormalizedFormat) {
  if (format === "jpeg") return new Set([".jpg", ".jpeg"]);
  return new Set([extensionForFormat(format)]);
}

function createFile(buffer: Buffer, originalName: string, format: NormalizedFormat, lastModified = Date.now()) {
  return new File([new Uint8Array(buffer)], `${baseNameOf(originalName)}${extensionForFormat(format)}`, {
    type: mimeForFormat(format),
    lastModified
  });
}

function isHeicFamily(buffer: Buffer, file: File) {
  if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;

  const primaryBrand = buffer.toString("ascii", 8, 12).toLowerCase();
  if (primaryBrand === "avif" || primaryBrand === "avis") return false;
  if (HEIC_BRANDS.has(primaryBrand)) return true;

  const declaredHeic = file.type === "image/heic" || file.type === "image/heif" || [".heic", ".heif"].includes(extensionOf(file.name));
  return declaredHeic && (primaryBrand === "mif1" || primaryBrand === "msf1");
}

function isBmp(buffer: Buffer) {
  return buffer.length >= 2 && buffer.toString("ascii", 0, 2) === "BM";
}

function isDirectProviderImage(metadata: Metadata, buffer: Buffer) {
  const format = metadata.format as NormalizedFormat | undefined;
  if (!format || !["jpeg", "png", "webp"].includes(format)) return false;
  if (buffer.length > MAX_PROVIDER_IMAGE_BYTES) return false;
  if (!metadata.width || !metadata.height) return false;
  if ((metadata.pages ?? 1) > 1) return false;
  if (metadata.isPalette) return false;
  if (metadata.depth && metadata.depth !== "uchar") return false;
  if (metadata.space && metadata.space !== "srgb") return false;
  if (metadata.channels && metadata.channels !== 3 && metadata.channels !== 4) return false;
  return true;
}

function needsFileMetadataCorrection(file: File, format: NormalizedFormat) {
  return file.type !== mimeForFormat(format) || !expectedExtensions(format).has(extensionOf(file.name));
}

function sharpPipeline(buffer: Buffer, width?: number, height?: number) {
  let pipeline = sharp(buffer, { animated: false, failOn: "none" }).rotate().toColourspace("srgb");
  if (width && height) {
    pipeline = pipeline.resize(width, height, {
      fit: "inside",
      withoutEnlargement: true
    });
  }
  return pipeline;
}

async function encodeAtSize(buffer: Buffer, hasAlpha: boolean, width?: number, height?: number) {
  let smallest: EncodedImage | null = null;

  const remember = (candidate: EncodedImage) => {
    if (!smallest || candidate.buffer.length < smallest.buffer.length) smallest = candidate;
    return candidate.buffer.length <= PROVIDER_TARGET_BYTES;
  };

  if (hasAlpha) {
    const png = await sharpPipeline(buffer, width, height).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    const candidate = { buffer: png, format: "png" as const };
    if (remember(candidate)) return candidate;

    for (const quality of WEBP_QUALITIES) {
      const webp = await sharpPipeline(buffer, width, height)
        .webp({ quality, alphaQuality: 100, effort: 4 })
        .toBuffer();
      const webpCandidate = { buffer: webp, format: "webp" as const };
      if (remember(webpCandidate)) return webpCandidate;
    }
  } else {
    for (const quality of JPEG_QUALITIES) {
      const jpeg = await sharpPipeline(buffer, width, height)
        .jpeg({ quality, chromaSubsampling: "4:4:4", mozjpeg: true })
        .toBuffer();
      const candidate = { buffer: jpeg, format: "jpeg" as const };
      if (remember(candidate)) return candidate;
    }
  }

  if (!smallest) {
    throw new ImageInputNormalizationError("IMAGE_CONVERSION_FAILED", "图片格式转换失败，请更换图片后再试");
  }
  return smallest;
}

async function convertToProviderImage(buffer: Buffer, metadata: Metadata) {
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;
  if (!originalWidth || !originalHeight) {
    throw new ImageInputNormalizationError("IMAGE_DECODE_FAILED", "无法读取图片尺寸，请确认图片文件未损坏");
  }

  let width = originalWidth;
  let height = originalHeight;
  let encoded = await encodeAtSize(buffer, Boolean(metadata.hasAlpha), width, height);

  for (let attempt = 0; encoded.buffer.length > MAX_PROVIDER_IMAGE_BYTES && attempt < 6; attempt += 1) {
    const scale = Math.max(0.35, Math.min(0.94, Math.sqrt(PROVIDER_TARGET_BYTES / encoded.buffer.length)));
    const nextWidth = Math.max(1, Math.floor(width * scale));
    const nextHeight = Math.max(1, Math.floor(height * scale));
    if (nextWidth === width && nextHeight === height) break;
    width = nextWidth;
    height = nextHeight;
    encoded = await encodeAtSize(buffer, Boolean(metadata.hasAlpha), width, height);
  }

  if (encoded.buffer.length > MAX_PROVIDER_IMAGE_BYTES) {
    throw new ImageInputNormalizationError(
      "IMAGE_TOO_LARGE",
      `图片自动优化后仍超过 ${formatImageByteLimit(MAX_PROVIDER_IMAGE_BYTES)}，请更换文件后再试`
    );
  }

  return encoded;
}

async function decodeHeic(buffer: Buffer) {
  try {
    const { default: heicConvert } = await import("heic-convert");
    const converted = await heicConvert({
      buffer,
      format: "JPEG",
      quality: 0.98
    });
    return Buffer.from(converted);
  } catch {
    throw new ImageInputNormalizationError("IMAGE_DECODE_FAILED", "无法读取 HEIC / HEIF 图片，请确认文件未损坏");
  }
}

async function decodeBmp(buffer: Buffer) {
  try {
    const decoded = bmp.decode(buffer);
    if (!decoded.width || !decoded.height || decoded.data.length !== decoded.width * decoded.height * 4) {
      throw new Error("invalid BMP dimensions");
    }

    const rgb = Buffer.allocUnsafe(decoded.width * decoded.height * 3);
    for (let source = 0, target = 0; source < decoded.data.length; source += 4, target += 3) {
      rgb[target] = decoded.data[source + 3];
      rgb[target + 1] = decoded.data[source + 2];
      rgb[target + 2] = decoded.data[source + 1];
    }

    return await sharp(rgb, {
      raw: { width: decoded.width, height: decoded.height, channels: 3 }
    })
      .png()
      .toBuffer();
  } catch {
    throw new ImageInputNormalizationError("IMAGE_DECODE_FAILED", "无法读取 BMP 图片，请确认文件未损坏");
  }
}

async function readMetadata(buffer: Buffer) {
  try {
    return await sharp(buffer, { animated: false, failOn: "none" }).metadata();
  } catch {
    throw new ImageInputNormalizationError(
      "UNSUPPORTED_IMAGE_TYPE",
      "无法识别图片内容。支持 JPEG、PNG、WebP，并可自动转换 HEIC、HEIF、AVIF、TIFF、GIF、BMP"
    );
  }
}

export async function normalizeImageInputFile(file: File) {
  if (file.size <= 0) {
    throw new ImageInputNormalizationError("EMPTY_IMAGE", "图片文件为空，请重新选择图片");
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new ImageInputNormalizationError(
      "IMAGE_TOO_LARGE",
      `原始图片不能超过 ${formatImageByteLimit(MAX_SOURCE_IMAGE_BYTES)}`
    );
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let decodedByCompatibilityAdapter = false;
  if (isHeicFamily(buffer, file)) {
    buffer = await decodeHeic(buffer);
    decodedByCompatibilityAdapter = true;
  } else if (isBmp(buffer)) {
    buffer = await decodeBmp(buffer);
    decodedByCompatibilityAdapter = true;
  }

  const metadata = await readMetadata(buffer);
  const format = metadata.format as NormalizedFormat | undefined;
  if (!format) {
    throw new ImageInputNormalizationError("UNSUPPORTED_IMAGE_TYPE", "无法识别图片格式，请更换图片后再试");
  }

  if (!decodedByCompatibilityAdapter && isDirectProviderImage(metadata, buffer)) {
    if (DIRECT_MIME_TYPES.has(mimeForFormat(format)) && !needsFileMetadataCorrection(file, format)) {
      return file;
    }
    return createFile(buffer, file.name, format, file.lastModified);
  }

  const encoded = await convertToProviderImage(buffer, metadata);
  return createFile(encoded.buffer, file.name, encoded.format, file.lastModified);
}
