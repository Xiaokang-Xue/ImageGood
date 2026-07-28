import "server-only";
import type { StoredImageTaskRecord } from "@/lib/db";
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

  if (hasPaidOrder) {
    const cleanUrl = markTrialImageUrl(
      `/api/tasks/${encodeURIComponent(task.id)}/download?inline=1`,
      task.id,
      "unlocked"
    );
    return {
      ...task,
      resultImageUrl: cleanUrl,
      resultImages: [cleanUrl]
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
