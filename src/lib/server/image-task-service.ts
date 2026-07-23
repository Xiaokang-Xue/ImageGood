import { randomUUID } from "crypto";
import { BillingError } from "@/lib/billing";
import { getDbSnapshot, getImageTaskById, getUserImageTaskPage, withDb } from "@/lib/db";
import { queryCodexTaskResult, recoverCodexTaskResult } from "@/lib/server/codex-image-provider";
import { isCosStorageEnabled } from "@/lib/server/cos-storage";
import {
  buildEditPrompt,
  buildImageEnhancePrompt,
  buildObjectRemovePrompt,
  buildPosterPrompt,
  buildProductPrompt,
  buildRemoveBackgroundPrompt,
  buildTextToImagePrompt
} from "@/lib/server/image-prompt-builder";
import { getImageProviderService } from "@/lib/server/image-provider";
import { normalizeImageInputFile } from "@/lib/server/image-input-normalizer";
import { logImageTaskEvent, type ImageTaskLogContext } from "@/lib/server/image-task-observability";
import {
  cleanupLocalTaskDirectoryAfterUpload,
  findSavedTaskResult,
  normalizeResultImages,
  saveUploadFile
} from "@/lib/server/image-storage";
import type {
  EditTool,
  ImageOutputFormat,
  ImageProvider,
  ImageQuality,
  ImageSize,
  PosterRatio,
  PosterStyle,
  PosterUsage,
  ProductRatio,
  ProductScene,
  ProductStyle,
  ProductTemplate,
  TextToImageStyle
} from "@/types/image";
import type { ImageTaskRecord, ImageTaskType } from "@/types/task";

function nowIso() {
  return new Date().toISOString();
}

function userFacingImageError(error: unknown) {
  const message = error instanceof Error ? error.message : "生成失败，请稍后重试";
  const lower = message.toLowerCase();

  if (lower.includes("invalid image file") || lower.includes("image file or mode") || lower.includes("unsupported image")) {
    return "图片已转换为标准 PNG，但模型仍无法读取内容，请更换图片后再试";
  }

  return message;
}

function createTask(input: {
  requestId?: string;
  userId: string;
  type: ImageTaskType;
  prompt: string;
  tool?: ImageTaskRecord["tool"];
  provider?: ImageProvider | null;
}) {
  const now = nowIso();
  return {
    id: normalizeTaskRequestId(input.requestId) || randomUUID(),
    userId: input.userId,
    type: input.type,
    prompt: input.prompt,
    tool: input.tool ?? null,
    status: "pending" as const,
    provider: input.provider ?? null,
    inputImageUrl: null,
    resultImageUrl: null,
    resultImages: [],
    creditCharged: false,
    errorMessage: null,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeTaskRequestId(value?: string) {
  const normalized = value?.trim() || "";
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(normalized)
    ? normalized
    : "";
}

async function insertTaskWithCreditCheck(task: ImageTaskRecord) {
  const result = await withDb((db) => {
    const existingTask = db.imageTasks.find((item) => item.id === task.id);
    if (existingTask) {
      if (existingTask.userId !== task.userId || existingTask.type !== task.type) {
        throw new Error("TASK_REQUEST_ID_CONFLICT");
      }
      return { task: existingTask, created: false as const };
    }

    const user = db.users.find((item) => item.id === task.userId);
    if (!user || user.credits <= 0) {
      throw new BillingError("INSUFFICIENT_CREDITS", "当前积分不足，请购买积分后继续生成", 402);
    }

    const activeUnchargedTasks = db.imageTasks.filter(
      (item) =>
        item.userId === task.userId &&
        !item.creditCharged &&
        (item.status === "pending" || item.status === "processing")
    ).length;

    if (user.credits - activeUnchargedTasks <= 0) {
      throw new BillingError("INSUFFICIENT_CREDITS", "当前积分不足，请等待正在生成的任务完成，或购买积分后继续生成", 402);
    }

    db.imageTasks.push(task);
    return { task, created: true as const };
  });

  if (!result.created) return result;

  logImageTaskEvent("task.created", {
    taskId: task.id,
    userId: task.userId,
    taskType: task.type,
    provider: task.provider,
    status: task.status,
    stage: "queue"
  });

  return result;
}

async function updateTask(taskId: string, patch: Partial<ImageTaskRecord>) {
  await withDb((db) => {
    const task = db.imageTasks.find((item) => item.id === taskId);
    if (!task) return;
    Object.assign(task, patch, { updatedAt: nowIso() });
  });
}

async function failTask(taskId: string, error: unknown) {
  const message = userFacingImageError(error);

  await withDb((db) => {
    const task = db.imageTasks.find((item) => item.id === taskId);
    if (!task || task.status === "succeeded") return;
    task.status = "failed";
    task.errorMessage = message;
    task.updatedAt = nowIso();
  });

  return message;
}

async function saveResults(userId: string, taskId: string, urls: string[]) {
  const savedImages = await normalizeResultImages(urls, userId, taskId);
  const resultImages = savedImages.filter(Boolean);

  if (resultImages.length === 0) {
    throw new Error("未检测到生成结果");
  }

  return {
    resultImages,
    resultImageUrl: resultImages[0] ?? null
  };
}

async function markTaskSucceeded(taskId: string, saved: { resultImages: string[]; resultImageUrl: string | null }) {
  return withDb((db) => {
    const task = db.imageTasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error("任务不存在");
    }

    const user = db.users.find((item) => item.id === task.userId);
    if (!user) {
      throw new Error("用户不存在");
    }

    const now = nowIso();
    task.status = "succeeded";
    task.resultImages = saved.resultImages;
    task.resultImageUrl = saved.resultImageUrl;
    task.errorMessage = null;
    task.updatedAt = now;

    const alreadyCharged =
      task.creditCharged ||
      db.creditTransactions.some((transaction) => transaction.type === "consume" && transaction.taskId === task.id);

    const creditChargedNow = !alreadyCharged;

    if (creditChargedNow) {
      user.credits -= 1;
      user.updatedAt = now;
      task.creditCharged = true;
      db.creditTransactions.push({
        id: randomUUID(),
        userId: user.id,
        taskId: task.id,
        orderId: null,
        type: "consume",
        amount: -1,
        balanceAfter: user.credits,
        reason: creditReasonForTask(task.type),
        createdAt: now
      });
    } else {
      task.creditCharged = true;
    }

    return {
      task,
      latestCredits: user.credits,
      creditChargedNow,
      creditsConsumed: creditChargedNow ? 1 : 0
    };
  });
}

function creditReasonForTask(type: ImageTaskType) {
  const labels: Record<ImageTaskType, string> = {
    edit: "AI 修图",
    product: "商品图生成",
    poster: "封面海报生成",
    text_to_image: "文生图",
    remove_background: "智能抠图",
    image_enhance: "图片增强",
    object_remove: "去杂物"
  };

  return labels[type] || "图片生成";
}

async function observeTaskStep<T>(input: {
  task: ImageTaskRecord;
  stage: NonNullable<ImageTaskLogContext["stage"]>;
  operation: string;
  run: () => Promise<T>;
  successFields?: (result: T) => Partial<ImageTaskLogContext>;
}) {
  const startedAt = Date.now();
  const baseContext = {
    taskId: input.task.id,
    userId: input.task.userId,
    taskType: input.task.type,
    provider: input.task.provider,
    stage: input.stage,
    operation: input.operation
  } satisfies ImageTaskLogContext;

  logImageTaskEvent("stage.started", baseContext);

  try {
    const result = await input.run();
    logImageTaskEvent("stage.succeeded", {
      ...(input.successFields?.(result) ?? {}),
      ...baseContext,
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    logImageTaskEvent(
      "stage.failed",
      {
        ...baseContext,
        durationMs: Date.now() - startedAt,
        error
      },
      "error"
    );
    throw error;
  }
}

async function saveTaskInput(task: ImageTaskRecord, image: File) {
  return observeTaskStep({
    task,
    stage: "input_storage",
    operation: "save_upload",
    run: async () => {
      const inputImageUrl = await saveUploadFile(image, task.userId, task.id);
      await updateTask(task.id, { inputImageUrl });
      return inputImageUrl;
    },
    successFields: () => ({
      inputImageCount: 1,
      storageProvider: isCosStorageEnabled() ? "cos" : "local"
    })
  });
}

function isTransientProviderError(error: unknown) {
  const value = error as { status?: number; code?: string; cause?: { code?: string } } | null;
  const status = Number(value?.status || 0);
  const code = String(value?.code || value?.cause?.code || "").toUpperCase();
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();

  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  if (["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_SOCKET"].includes(code)) return true;
  return [
    "connection error",
    "connection reset",
    "fetch failed",
    "network error",
    "socket hang up",
    "stream disconnected",
    "temporarily unavailable",
    "timed out",
    "timeout"
  ].some((keyword) => message.includes(keyword));
}

async function runProviderWithRetry<T>(task: ImageTaskRecord, operation: string, run: () => Promise<T>) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientProviderError(error)) throw error;

      logImageTaskEvent(
        "provider.retry_scheduled",
        {
          taskId: task.id,
          userId: task.userId,
          taskType: task.type,
          provider: task.provider,
          stage: "provider",
          operation,
          error
        },
        "warn"
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  throw new Error("IMAGE_PROVIDER_RETRY_EXHAUSTED");
}

async function runProviderStep<T>(task: ImageTaskRecord, operation: string, run: () => Promise<T>) {
  return observeTaskStep({
    task,
    stage: "provider",
    operation,
    run: () => runProviderWithRetry(task, operation, run),
    successFields: () => ({ outputImageCount: 1 })
  });
}

function isProviderImageCompatibilityError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("invalid image file") ||
    message.includes("image file or mode") ||
    message.includes("unsupported image") ||
    message.includes("模型输入必须是标准 png")
  );
}

async function runProviderImageStep<T>(
  task: ImageTaskRecord,
  operation: string,
  image: File,
  run: (providerImage: File) => Promise<T>
) {
  return runProviderStep(task, operation, async () => {
    try {
      return await run(image);
    } catch (error) {
      if (!isProviderImageCompatibilityError(error)) throw error;

      logImageTaskEvent(
        "input.compatibility_retry.started",
        {
          taskId: task.id,
          userId: task.userId,
          taskType: task.type,
          provider: task.provider,
          stage: "provider",
          operation
        },
        "warn"
      );

      const retryImage = await normalizeImageInputFile(image, { forceReencode: true });
      const result = await run(retryImage);

      logImageTaskEvent("input.compatibility_retry.succeeded", {
        taskId: task.id,
        userId: task.userId,
        taskType: task.type,
        provider: task.provider,
        stage: "provider",
        operation
      });
      return result;
    }
  });
}

async function completeTask(task: ImageTaskRecord, generatedUrl: string) {
  const saved = await observeTaskStep({
    task,
    stage: "result_storage",
    operation: "save_generated_result",
    run: () => saveResults(task.userId, task.id, [generatedUrl]),
    successFields: (result) => ({
      outputImageCount: result.resultImages.length,
      storageProvider: isCosStorageEnabled() ? "cos" : "local"
    })
  });

  const result = await observeTaskStep({
    task,
    stage: "database",
    operation: "mark_succeeded_and_charge_credit",
    run: () => markTaskSucceeded(task.id, saved),
    successFields: (completed) => ({
      status: "succeeded",
      creditCharged: completed.task.creditCharged === true,
      creditsConsumed: completed.creditsConsumed,
      latestCredits: completed.latestCredits
    })
  });

  try {
    await observeTaskStep({
      task,
      stage: "cleanup",
      operation: "cleanup_local_task_directory",
      run: () => cleanupLocalTaskDirectoryAfterUpload(task.id)
    });
  } catch (error) {
    logImageTaskEvent(
      "cleanup.skipped",
      {
        taskId: task.id,
        userId: task.userId,
        taskType: task.type,
        provider: task.provider,
        stage: "cleanup",
        status: "succeeded",
        error
      },
      "warn"
    );
  }

  logImageTaskEvent("task.succeeded", {
    taskId: task.id,
    userId: task.userId,
    taskType: task.type,
    provider: task.provider,
    status: "succeeded",
    totalDurationMs: Math.max(0, Date.now() - new Date(task.createdAt).getTime()),
    outputImageCount: saved.resultImages.length,
    creditCharged: result.task.creditCharged === true,
    creditsConsumed: result.creditsConsumed,
    latestCredits: result.latestCredits
  });

  return result;
}

const taskRecoveryAttemptAt = new Map<string, number>();

async function recoverTaskResultIfPresent(taskId: string, options?: { polling?: boolean }) {
  const task = await getImageTaskById(taskId);
  if (!task) return null;

  if (options?.polling) {
    const now = Date.now();
    const minimumAgeMs = task.provider === "codex" ? 5000 : task.status === "failed" ? 5000 : 120_000;
    const lastAttemptAt = taskRecoveryAttemptAt.get(task.id) || 0;
    const taskAgeMs = now - new Date(task.updatedAt).getTime();
    if (taskAgeMs < minimumAgeMs || now - lastAttemptAt < minimumAgeMs) return null;
    taskRecoveryAttemptAt.set(task.id, now);
  }

  const startedAt = Date.now();
  logImageTaskEvent("recovery.started", {
    taskId: task.id,
    userId: task.userId,
    taskType: task.type,
    provider: task.provider,
    stage: "recovery"
  });

  const savedResult = await findSavedTaskResult(task.userId, task.id);
  const recovered = savedResult
    ? { url: savedResult }
    : task.provider === "codex"
      ? (await queryCodexTaskResult(task.id)) || (await recoverCodexTaskResult(task.id))
      : null;
  if (!recovered) {
    logImageTaskEvent(
      "recovery.not_found",
      {
        taskId: task.id,
        userId: task.userId,
        taskType: task.type,
        provider: task.provider,
        stage: "recovery",
        durationMs: Date.now() - startedAt
      },
      "warn"
    );
    return null;
  }

  const result = await completeTask(task, recovered.url);
  taskRecoveryAttemptAt.delete(task.id);
  logImageTaskEvent("recovery.succeeded", {
    taskId: task.id,
    userId: task.userId,
    taskType: task.type,
    provider: task.provider,
    stage: "recovery",
    status: "succeeded",
    durationMs: Date.now() - startedAt,
    latestCredits: result.latestCredits
  });
  return result.task;
}

function startBackgroundTask(task: ImageTaskRecord, runner: () => Promise<void>) {
  void (async () => {
    const startedAt = Date.now();

    try {
      await updateTask(task.id, { status: "processing" });
      logImageTaskEvent("task.processing", {
        taskId: task.id,
        userId: task.userId,
        taskType: task.type,
        provider: task.provider,
        status: "processing",
        stage: "queue",
        durationMs: Date.now() - startedAt
      });
      await runner();
    } catch (error) {
      try {
        const recovered = await recoverTaskResultIfPresent(task.id);
        if (recovered) return;
      } catch (recoveryError) {
        logImageTaskEvent(
          "recovery.failed",
          {
            taskId: task.id,
            userId: task.userId,
            taskType: task.type,
            provider: task.provider,
            stage: "recovery",
            error: recoveryError
          },
          "error"
        );
      }

      await failTask(task.id, error);
      logImageTaskEvent("task.failed", {
        taskId: task.id,
        userId: task.userId,
        taskType: task.type,
        provider: task.provider,
        status: "failed",
        totalDurationMs: Math.max(0, Date.now() - new Date(task.createdAt).getTime()),
        creditCharged: false,
        creditsConsumed: 0,
        error
      }, "error");
    }
  })();
}

function startResponse(task: ImageTaskRecord) {
  return {
    ok: true,
    taskId: task.id,
    status: task.status,
    mode: task.provider === "mock" ? ("mock" as const) : ("real" as const),
    provider: task.provider ?? undefined,
    results: []
  };
}

export async function runEditTask(input: {
  requestId?: string;
  userId: string;
  image: File;
  prompt?: string;
  tool: EditTool;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
}) {
  const provider = getImageProviderService();
  const prompt = buildEditPrompt(input.tool, input.prompt);
  const task = createTask({
    requestId: input.requestId,
    userId: input.userId,
    type: "edit",
    prompt,
    tool: input.tool,
    provider: provider.name
  });

  const inserted = await insertTaskWithCreditCheck(task);
  if (!inserted.created) return startResponse(inserted.task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderImageStep(task, "edit", input.image, (providerImage) =>
      provider.editImage({
        taskId: task.id,
        image: providerImage,
        prompt,
        size: input.size,
        quality: input.quality,
        outputFormat: input.outputFormat
      })
    );
    await completeTask(task, generated.url);
  });

  return startResponse(task);
}

export async function runProductTask(input: {
  requestId?: string;
  userId: string;
  image: File;
  template: ProductTemplate;
  scene: ProductScene;
  style: ProductStyle;
  sellingPoints: string;
  ratio: ProductRatio;
  size: ImageSize;
}) {
  const provider = getImageProviderService();
  const prompt = buildProductPrompt(input);
  const task = createTask({
    requestId: input.requestId,
    userId: input.userId,
    type: "product",
    prompt,
    tool: "product",
    provider: provider.name
  });

  const inserted = await insertTaskWithCreditCheck(task);
  if (!inserted.created) return startResponse(inserted.task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderImageStep(task, "edit_product", input.image, (providerImage) =>
      provider.editImage({
        taskId: task.id,
        image: providerImage,
        prompt,
        size: input.size,
        quality: "auto",
        outputFormat: "png"
      })
    );
    await completeTask(task, generated.url);
  });

  return startResponse(task);
}

export async function runPosterTask(input: {
  requestId?: string;
  userId: string;
  title: string;
  subtitle: string;
  usage: PosterUsage;
  style: PosterStyle;
  ratio: PosterRatio;
  size: ImageSize;
}) {
  const provider = getImageProviderService();
  const prompt = buildPosterPrompt(input);
  const task = createTask({
    requestId: input.requestId,
    userId: input.userId,
    type: "poster",
    prompt,
    tool: "poster",
    provider: provider.name
  });

  const inserted = await insertTaskWithCreditCheck(task);
  if (!inserted.created) return startResponse(inserted.task);

  startBackgroundTask(task, async () => {
    const generated = await runProviderStep(task, "generate_poster", () =>
      provider.generateImage({
        taskId: task.id,
        prompt,
        size: input.size,
        quality: "auto",
        outputFormat: "png"
      })
    );
    await completeTask(task, generated.url);
  });

  return startResponse(task);
}

export async function runTextToImageTask(input: {
  requestId?: string;
  userId: string;
  prompt: string;
  style?: TextToImageStyle;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
}) {
  const provider = getImageProviderService();
  const prompt = buildTextToImagePrompt({
    prompt: input.prompt,
    style: input.style
  });
  const task = createTask({
    requestId: input.requestId,
    userId: input.userId,
    type: "text_to_image",
    prompt,
    tool: "text_to_image",
    provider: provider.name
  });

  const inserted = await insertTaskWithCreditCheck(task);
  if (!inserted.created) return startResponse(inserted.task);

  startBackgroundTask(task, async () => {
    const generated = await runProviderStep(task, "generate_text_to_image", () =>
      provider.generateImage({
        taskId: task.id,
        prompt,
        size: input.size,
        quality: input.quality,
        outputFormat: input.outputFormat
      })
    );
    await completeTask(task, generated.url);
  });

  return startResponse(task);
}

export async function runRemoveBackgroundTask(input: {
  requestId?: string;
  userId: string;
  image: File;
  size: ImageSize;
  quality: ImageQuality;
  prompt?: string;
}) {
  const provider = getImageProviderService();
  const prompt = buildRemoveBackgroundPrompt(input.prompt);
  const task = createTask({
    requestId: input.requestId,
    userId: input.userId,
    type: "remove_background",
    prompt,
    tool: "remove_background",
    provider: provider.name
  });

  const inserted = await insertTaskWithCreditCheck(task);
  if (!inserted.created) return startResponse(inserted.task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderImageStep(task, "remove_background", input.image, (providerImage) =>
      provider.removeBackground({
        taskId: task.id,
        image: providerImage,
        prompt,
        size: input.size,
        quality: input.quality
      })
    );
    await completeTask(task, generated.url);
  });

  return startResponse(task);
}

async function runPromptedImageEditTask(input: {
  requestId?: string;
  userId: string;
  image: File;
  prompt: string;
  type: Extract<ImageTaskType, "image_enhance" | "object_remove">;
  tool: "image_enhance" | "object_remove";
  size: ImageSize;
  quality: ImageQuality;
  outputFormat?: ImageOutputFormat;
}) {
  const provider = getImageProviderService();
  const task = createTask({
    requestId: input.requestId,
    userId: input.userId,
    type: input.type,
    prompt: input.prompt,
    tool: input.tool,
    provider: provider.name
  });

  const inserted = await insertTaskWithCreditCheck(task);
  if (!inserted.created) return startResponse(inserted.task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderImageStep(task, input.type, input.image, (providerImage) =>
      provider.editImage({
        taskId: task.id,
        image: providerImage,
        prompt: input.prompt,
        size: input.size,
        quality: input.quality,
        outputFormat: input.outputFormat || "png"
      })
    );
    await completeTask(task, generated.url);
  });

  return startResponse(task);
}

export async function runImageEnhanceTask(input: {
  requestId?: string;
  userId: string;
  image: File;
  prompt?: string;
  size: ImageSize;
  quality: ImageQuality;
}) {
  return runPromptedImageEditTask({
    requestId: input.requestId,
    userId: input.userId,
    image: input.image,
    prompt: buildImageEnhancePrompt(input.prompt),
    type: "image_enhance",
    tool: "image_enhance",
    size: input.size,
    quality: input.quality,
    outputFormat: "png"
  });
}

export async function runObjectRemoveTask(input: {
  requestId?: string;
  userId: string;
  image: File;
  prompt?: string;
  size: ImageSize;
  quality: ImageQuality;
}) {
  return runPromptedImageEditTask({
    requestId: input.requestId,
    userId: input.userId,
    image: input.image,
    prompt: buildObjectRemovePrompt(input.prompt),
    type: "object_remove",
    tool: "object_remove",
    size: input.size,
    quality: input.quality,
    outputFormat: "png"
  });
}

export async function listUserTasks(userId: string, options?: { page?: number; limit?: number }) {
  return getUserImageTaskPage(userId, options?.page, options?.limit);
}

export async function getUserTask(userId: string, taskId: string) {
  const ownedTask = await getImageTaskById(taskId);
  if (!ownedTask || ownedTask.userId !== userId) return null;

  if (ownedTask.status !== "succeeded" || !ownedTask.resultImages?.length) {
    try {
      await recoverTaskResultIfPresent(ownedTask.id, { polling: true });
    } catch (error) {
      logImageTaskEvent(
        "recovery.poll_failed",
        {
          taskId: ownedTask.id,
          userId,
          taskType: ownedTask.type,
          provider: ownedTask.provider,
          stage: "recovery",
          error
        },
        "warn"
      );
    }
  }

  const latestTask = await getImageTaskById(taskId);
  return latestTask?.userId === userId ? latestTask : null;
}

function isDeletableTask(task: ImageTaskRecord) {
  return task.status === "succeeded" || task.status === "failed";
}

export async function deleteUserTask(userId: string, taskId: string) {
  return withDb((db) => {
    const task = db.imageTasks.find((item) => item.userId === userId && item.id === taskId);
    if (!task) {
      return { deleted: false as const, reason: "not_found" as const };
    }
    if (!isDeletableTask(task)) {
      return { deleted: false as const, reason: "in_progress" as const };
    }

    db.imageTasks = db.imageTasks.filter((item) => item.id !== task.id);
    return { deleted: true as const, id: task.id };
  });
}

export async function deleteUserTasks(userId: string, taskIds: string[]) {
  const uniqueIds = [...new Set(taskIds.map((id) => id.trim()).filter(Boolean))].slice(0, 100);

  return withDb((db) => {
    const deletedIds: string[] = [];
    const skippedIds: string[] = [];
    const idsToDelete = new Set<string>();

    for (const taskId of uniqueIds) {
      const task = db.imageTasks.find((item) => item.userId === userId && item.id === taskId);
      if (!task || !isDeletableTask(task)) {
        skippedIds.push(taskId);
        continue;
      }
      idsToDelete.add(task.id);
      deletedIds.push(task.id);
    }

    if (idsToDelete.size > 0) {
      db.imageTasks = db.imageTasks.filter((task) => !idsToDelete.has(task.id));
    }

    return {
      deletedIds,
      skippedIds
    };
  });
}
