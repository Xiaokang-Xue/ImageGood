import { base64ToDataUrl } from "@/lib/server/image-storage";
import type { ImageOutputFormat, ImageQuality, ImageSize } from "@/types/image";

interface EditImageInput {
  image: File;
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
}

interface GenerateImageInput {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
}

interface RemoveBackgroundInput {
  image: File;
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
}

type OpenAIImageClient = {
  images: {
    edit: (input: Record<string, unknown>) => Promise<{ data?: Array<{ b64_json?: string | null; url?: string | null }> | null }>;
    generate: (input: Record<string, unknown>) => Promise<{ data?: Array<{ b64_json?: string | null; url?: string | null }> | null }>;
  };
};

type OpenAIConstructor = new (options: { apiKey: string; baseURL?: string }) => OpenAIImageClient;
type ToFile = (value: Buffer, filename: string, options: { type: string }) => Promise<unknown>;

let client: OpenAIImageClient | null = null;
let toOpenAIFile: ToFile | null = null;

function getImageModel() {
  return process.env.IMAGE_MODEL || "gpt-image-1";
}

function getOpenAIBaseUrl() {
  const value = (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE_URL || "").trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "") {
      url.pathname = "/v1";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    return value;
  }

  return value.replace(/\/+$/, "");
}

async function loadOpenAISdk() {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{
    default: OpenAIConstructor;
    toFile: ToFile;
  }>;

  try {
    const sdk = await dynamicImport("openai");
    toOpenAIFile = sdk.toFile;
    return sdk.default;
  } catch {
    throw new Error("OpenAI SDK 未安装，请先运行 npm install openai");
  }
}

async function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!client) {
    const OpenAI = await loadOpenAISdk();
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: getOpenAIBaseUrl()
    });
  }

  return client;
}

async function toUploadableImage(file: File) {
  if (!toOpenAIFile) {
    await loadOpenAISdk();
  }

  if (!toOpenAIFile) {
    throw new Error("OpenAI SDK 上传工具不可用");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return toOpenAIFile(buffer, file.name || "input-image.png", {
    type: file.type || "image/png"
  });
}

function firstImageResult(
  result: { data?: Array<{ b64_json?: string | null; url?: string | null }> | null },
  outputFormat: ImageOutputFormat
) {
  const item = result.data?.[0];
  const base64 = item?.b64_json;
  if (base64) {
    return {
      base64,
      url: base64ToDataUrl(base64, outputFormat)
    };
  }

  if (item?.url) {
    return {
      base64: undefined,
      url: item.url
    };
  }

  throw new Error("模型返回结果为空");
}

export async function editImage(input: EditImageInput) {
  const image = await toUploadableImage(input.image);
  const result = await (await getClient()).images.edit({
    model: getImageModel(),
    image,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    output_format: input.outputFormat
  });

  return firstImageResult(result, input.outputFormat);
}

export async function generateImage(input: GenerateImageInput) {
  const result = await (await getClient()).images.generate({
    model: getImageModel(),
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    output_format: input.outputFormat
  });

  return firstImageResult(result, input.outputFormat);
}

export async function removeBackground(input: RemoveBackgroundInput) {
  return editImage({
    image: input.image,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    outputFormat: "png"
  });
}
