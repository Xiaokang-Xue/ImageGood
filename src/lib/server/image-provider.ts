import {
  editImage as editImageWithOpenAI,
  generateImage as generateImageWithOpenAI,
  removeBackground as removeBackgroundWithOpenAI
} from "@/lib/server/openai-image-service";
import { createCodexImageProvider } from "@/lib/server/codex-image-provider";
import { createMockImageProvider } from "@/lib/server/mock-image-provider";
import type { ImageOutputFormat, ImageQuality, ImageSize } from "@/types/image";

export interface ProviderEditInput {
  taskId?: string;
  image: File;
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
}

export interface ProviderGenerateInput {
  taskId?: string;
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
}

export interface ProviderRemoveBackgroundInput {
  taskId?: string;
  image: File;
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
}

export interface ProviderImageResult {
  url: string;
}

export interface ImageProviderService {
  name: "codex" | "openai" | "mock";
  editImage(input: ProviderEditInput): Promise<ProviderImageResult>;
  generateImage(input: ProviderGenerateInput): Promise<ProviderImageResult>;
  removeBackground(input: ProviderRemoveBackgroundInput): Promise<ProviderImageResult>;
}

function shouldUseMockProvider() {
  if (process.env.IMAGE_API_MODE !== "real") return true;
  const provider = process.env.IMAGE_PROVIDER || "codex";
  return provider === "openai" && !process.env.OPENAI_API_KEY;
}

export function getImageProviderService(): ImageProviderService {
  if (shouldUseMockProvider()) {
    return createMockImageProvider();
  }

  const provider = (process.env.IMAGE_PROVIDER || "codex").toLowerCase();

  if (provider === "openai") {
    return {
      name: "openai",
      editImage: editImageWithOpenAI,
      generateImage: generateImageWithOpenAI,
      removeBackground: removeBackgroundWithOpenAI
    };
  }

  return createCodexImageProvider();
}
