import "server-only";
import type { StoredImageTaskRecord } from "@/lib/db";
import {
  getCosObjectSignedUrl,
  isCosStorageEnabled
} from "@/lib/server/cos-storage";
import { cosImagePreviewQuery } from "@/lib/server/image-preview";
import { markTrialImageUrl } from "@/lib/trial-image";
import type { ImageTaskRecord } from "@/types/task";

export function toPublicImageTask(
  storedTask: StoredImageTaskRecord,
  hasPaidOrder: boolean
): ImageTaskRecord {
  const { originalResultImages, ...task } = storedTask;
  if (!task.isFreeTrial || !task.hasWatermark || !originalResultImages?.length) {
    return task;
  }

  if (hasPaidOrder || Boolean(task.unlockedAt)) {
    const cleanUrl = markTrialImageUrl(
      `/api/tasks/${encodeURIComponent(task.id)}/download?inline=1`,
      task.id,
      "unlocked"
    );
    return {
      ...task,
      resultImageUrl: cleanUrl,
      resultImages: [cleanUrl],
      resultImagePreviewUrl: task.resultImages?.[0] || task.resultImageUrl || null,
      resultImagePreviewUrls: task.resultImages || []
    };
  }

  const resultImages = (task.resultImages || []).map((url) =>
    markTrialImageUrl(url, task.id, "locked")
  );
  return {
    ...task,
    resultImageUrl: task.resultImageUrl
      ? markTrialImageUrl(task.resultImageUrl, task.id, "locked")
      : resultImages[0] ?? null,
    resultImages
  };
}

function storageProxyKey(imageUrl: string | null | undefined) {
  if (!imageUrl) return "";
  const pathname = imageUrl.split("#")[0].split("?")[0];
  const prefix = "/api/storage/images/";
  if (!pathname.startsWith(prefix)) return "";

  try {
    return pathname
      .slice(prefix.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return "";
  }
}

async function createDirectPreviewUrl(imageUrl: string | null | undefined, width: number) {
  if (!isCosStorageEnabled()) return imageUrl || null;
  const key = storageProxyKey(imageUrl);
  if (!key) return imageUrl || null;

  try {
    return await getCosObjectSignedUrl(key, cosImagePreviewQuery(width));
  } catch {
    return imageUrl || null;
  }
}

export async function withImageTaskPreviews(task: ImageTaskRecord, width: number) {
  const resultImages = task.resultImagePreviewUrls?.length
    ? task.resultImagePreviewUrls
    : task.resultImages || [];
  const shouldPreviewInput = resultImages.length === 0 && task.status !== "pending" && task.status !== "processing";
  const [inputImagePreviewUrl, resultImagePreviewUrls] = await Promise.all([
    shouldPreviewInput ? createDirectPreviewUrl(task.inputImageUrl, width) : Promise.resolve(null),
    Promise.all(
      resultImages.map(async (imageUrl) =>
        (await createDirectPreviewUrl(imageUrl, width)) || imageUrl
      )
    )
  ]);

  return {
    ...task,
    inputImagePreviewUrl,
    resultImagePreviewUrl:
      resultImagePreviewUrls[0] || (await createDirectPreviewUrl(task.resultImageUrl, width)),
    resultImagePreviewUrls
  } satisfies ImageTaskRecord;
}
