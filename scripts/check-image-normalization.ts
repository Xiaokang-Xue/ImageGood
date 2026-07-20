import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { MAX_PROVIDER_IMAGE_BYTES } from "../src/config/image-upload";
import { detectBrowserImageMimeType, imageExtensionFromMimeType } from "../src/lib/server/image-file";
import { ImageInputNormalizationError, normalizeImageInputFile } from "../src/lib/server/image-input-normalizer";

function asFile(buffer: Buffer, name: string, type: string) {
  return new File([new Uint8Array(buffer)], name, { type });
}

async function assertProviderReady(file: File) {
  assert.ok(file.size <= MAX_PROVIDER_IMAGE_BYTES, `${file.name} exceeds provider input limit`);
  assert.equal(file.type, "image/png", `${file.name} has invalid MIME`);
  assert.ok(file.name.toLowerCase().endsWith(".png"), `${file.name} has invalid extension`);

  const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
  assert.equal(metadata.format, "png", `${file.name} has invalid encoding`);
  assert.equal(metadata.space, "srgb", `${file.name} is not sRGB`);
  assert.ok(metadata.channels === 3 || metadata.channels === 4, `${file.name} has invalid channel count`);
  assert.equal(metadata.depth, "uchar", `${file.name} has invalid bit depth`);
  assert.equal(metadata.pages ?? 1, 1, `${file.name} is still animated`);
}

function createBmp(width: number, height: number) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const buffer = Buffer.alloc(54 + pixelBytes);
  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelBytes, 34);
  for (let offset = 54; offset < buffer.length; offset += 3) {
    buffer[offset] = 72;
    buffer[offset + 1] = 146;
    buffer[offset + 2] = 218;
  }
  return buffer;
}

async function main() {
  const heicModule = await import("heic-convert");
  assert.equal(typeof heicModule.default, "function", "HEIC compatibility adapter is unavailable");

  const source = sharp({
    create: {
      width: 48,
      height: 32,
      channels: 3,
      background: { r: 42, g: 108, b: 190 }
    }
  });

  const jpeg = await source.clone().jpeg({ quality: 92 }).toBuffer();
  assert.equal(detectBrowserImageMimeType(jpeg), "image/jpeg", "JPEG result MIME detection failed");
  assert.equal(imageExtensionFromMimeType("application/octet-stream"), "png", "unknown MIME fallback changed");
  const jpegFile = asFile(jpeg, "valid.jpg", "image/jpeg");
  const normalizedJpeg = await normalizeImageInputFile(jpegFile);
  assert.notEqual(normalizedJpeg, jpegFile, "JPEG should be converted to the provider-safe PNG contract");
  await assertProviderReady(normalizedJpeg);

  const rgba = await sharp({
    create: {
      width: 48,
      height: 32,
      channels: 4,
      background: { r: 220, g: 80, b: 110, alpha: 0.5 }
    }
  })
    .png()
    .toBuffer();
  assert.equal(detectBrowserImageMimeType(rgba), "image/png", "PNG result MIME detection failed");
  const pngFile = asFile(rgba, "transparent.png", "image/png");
  const untouchedPng = await normalizeImageInputFile(pngFile);
  assert.equal(untouchedPng, pngFile, "valid PNG should remain byte-for-byte untouched");
  const compatibilityRetryPng = await normalizeImageInputFile(pngFile, { forceReencode: true });
  assert.notEqual(compatibilityRetryPng, pngFile, "compatibility retry should force a fresh PNG encoding");
  await assertProviderReady(compatibilityRetryPng);

  const mislabeled = await normalizeImageInputFile(asFile(jpeg, "camera.bin", "application/octet-stream"));
  await assertProviderReady(mislabeled);

  const conversions: Array<{ label: string; file: File }> = [
    { label: "WebP", file: asFile(await source.clone().webp().toBuffer(), "camera.webp", "image/webp") },
    { label: "AVIF", file: asFile(await source.clone().avif().toBuffer(), "camera.avif", "image/avif") },
    { label: "TIFF", file: asFile(await source.clone().tiff().toBuffer(), "camera.tiff", "image/tiff") },
    { label: "GIF", file: asFile(await source.clone().gif().toBuffer(), "camera.gif", "image/gif") },
    { label: "BMP", file: asFile(createBmp(16, 16), "camera.bmp", "image/bmp") },
    {
      label: "CMYK JPEG",
      file: asFile(await source.clone().toColourspace("cmyk").jpeg().toBuffer(), "print.jpg", "image/jpeg")
    },
    {
      label: "grayscale PNG",
      file: asFile(
        await source.clone().toColourspace("b-w").png().toBuffer(),
        "gray.png",
        "image/png"
      )
    }
  ];

  for (const item of conversions) {
    try {
      const normalized = await normalizeImageInputFile(item.file);
      assert.notEqual(normalized, item.file, `${item.label} should be normalized before task creation`);
      await assertProviderReady(normalized);
    } catch (error) {
      throw new Error(`${item.label}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const heicPath = process.argv.find((argument) => argument.startsWith("--heic-file="))?.slice("--heic-file=".length);
  if (heicPath) {
    const heic = await readFile(heicPath);
    const normalized = await normalizeImageInputFile(asFile(heic, "iphone-photo.heic", "image/heic"));
    await assertProviderReady(normalized);
    console.log(`[image-formats] real HEIC fixture OK: ${heic.length} bytes -> ${normalized.size} byte PNG`);
  }

  await assert.rejects(
    () => normalizeImageInputFile(asFile(Buffer.from("not an image"), "broken.jpg", "image/jpeg")),
    (error: unknown) => error instanceof ImageInputNormalizationError
  );

  console.log(
    "[image-formats] OK: standard PNG preserved; JPEG/WebP/AVIF/TIFF/GIF/BMP/CMYK/grayscale normalized to PNG before task creation"
  );
}

main().catch((error) => {
  console.error("[image-formats] FAILED", error instanceof Error ? error.message : error);
  process.exit(1);
});
