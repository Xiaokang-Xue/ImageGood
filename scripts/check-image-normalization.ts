import assert from "node:assert/strict";
import sharp from "sharp";
import { MAX_PROVIDER_IMAGE_BYTES } from "../src/config/image-upload";
import { ImageInputNormalizationError, normalizeImageInputFile } from "../src/lib/server/image-input-normalizer";

function asFile(buffer: Buffer, name: string, type: string) {
  return new File([new Uint8Array(buffer)], name, { type });
}

async function assertProviderReady(file: File, expectedFormat?: "jpeg" | "png" | "webp") {
  assert.ok(file.size <= MAX_PROVIDER_IMAGE_BYTES, `${file.name} exceeds provider input limit`);
  assert.ok(["image/jpeg", "image/png", "image/webp"].includes(file.type), `${file.name} has invalid MIME`);

  const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
  assert.ok(["jpeg", "png", "webp"].includes(metadata.format || ""), `${file.name} has invalid encoding`);
  assert.equal(metadata.space, "srgb", `${file.name} is not sRGB`);
  assert.ok(metadata.channels === 3 || metadata.channels === 4, `${file.name} has invalid channel count`);
  assert.equal(metadata.depth, "uchar", `${file.name} has invalid bit depth`);
  assert.equal(metadata.pages ?? 1, 1, `${file.name} is still animated`);
  if (expectedFormat) assert.equal(metadata.format, expectedFormat);
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
  const jpegFile = asFile(jpeg, "valid.jpg", "image/jpeg");
  const untouchedJpeg = await normalizeImageInputFile(jpegFile);
  assert.equal(untouchedJpeg, jpegFile, "valid JPEG should remain byte-for-byte untouched");

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
  const pngFile = asFile(rgba, "transparent.png", "image/png");
  const untouchedPng = await normalizeImageInputFile(pngFile);
  assert.equal(untouchedPng, pngFile, "valid PNG should remain byte-for-byte untouched");

  const mislabeled = await normalizeImageInputFile(asFile(jpeg, "camera.bin", "application/octet-stream"));
  assert.equal(mislabeled.type, "image/jpeg");
  assert.deepEqual(Buffer.from(await mislabeled.arrayBuffer()), jpeg, "MIME correction must not re-encode valid bytes");

  const conversions: Array<{ label: string; file: File }> = [
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

  await assert.rejects(
    () => normalizeImageInputFile(asFile(Buffer.from("not an image"), "broken.jpg", "image/jpeg")),
    (error: unknown) => error instanceof ImageInputNormalizationError
  );

  console.log(
    "[image-formats] OK: direct JPEG/PNG preserved; AVIF/TIFF/GIF/BMP/CMYK/grayscale normalized before task creation"
  );
}

main().catch((error) => {
  console.error("[image-formats] FAILED", error instanceof Error ? error.message : error);
  process.exit(1);
});
