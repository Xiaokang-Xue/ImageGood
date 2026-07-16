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
import { logImageTaskEvent, type ImageTaskLogContext } from "@/lib/server/image-task-observability";
import { cleanupLocalTaskDirectoryAfterUpload, normalizeResultImages, saveUploadFile } from "@/lib/server/image-storage";
import { assertPaymentSourceSurveyCompleted } from "@/lib/server/payment-source-survey";
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
    return "图片已完成兼容性检查，但模型仍无法读取内容，请更换图片后再试";
  }

  return message;
}

function createTask(input: {
  userId: string;
  type: ImageTaskType;
  prompt: string;
  tool?: ImageTaskRecord["tool"];
  provider?: ImageProvider | null;
}) {
  const now = nowIso();
  return {
    id: randomUUID(),
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

async function insertTaskWithCreditCheck(task: ImageTaskRecord) {
  await assertPaymentSourceSurveyCompleted(task.userId);

  await withDb((db) => {
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
  });

  logImageTaskEvent("task.created", {
    taskId: task.id,
    userId: task.userId,
    taskType: task.type,
    provider: task.provider,
    status: task.status,
    stage: "queue"
  });
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

async function runProviderStep<T>(task: ImageTaskRecord, operation: string, run: () => Promise<T>) {
  return observeTaskStep({
    task,
    stage: "provider",
    operation,
    run,
    successFields: () => ({ outputImageCount: 1 })
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

async function recoverTaskResultIfPresent(taskId: string) {
  const task = await getImageTaskById(taskId);
  if (!task || task.provider !== "codex") return null;

  const startedAt = Date.now();
  logImageTaskEvent("recovery.started", {
    taskId: task.id,
    userId: task.userId,
    taskType: task.type,
    provider: task.provider,
    stage: "recovery"
  });

  const recovered = (await queryCodexTaskResult(task.id)) || (await recoverCodexTaskResult(task.id));
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
    userId: input.userId,
    type: "edit",
    prompt,
    tool: input.tool,
    provider: provider.name
  });

  await insertTaskWithCreditCheck(task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderStep(task, "edit", () =>
      provider.editImage({
        taskId: task.id,
        image: input.image,
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
    userId: input.userId,
    type: "product",
    prompt,
    tool: "product",
    provider: provider.name
  });

  await insertTaskWithCreditCheck(task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderStep(task, "edit_product", () =>
      provider.editImage({
        taskId: task.id,
        image: input.image,
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
    userId: input.userId,
    type: "poster",
    prompt,
    tool: "poster",
    provider: provider.name
  });

  await insertTaskWithCreditCheck(task);

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
    userId: input.userId,
    type: "text_to_image",
    prompt,
    tool: "text_to_image",
    provider: provider.name
  });

  await insertTaskWithCreditCheck(task);

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
  userId: string;
  image: File;
  size: ImageSize;
  quality: ImageQuality;
  prompt?: string;
}) {
  const provider = getImageProviderService();
  const prompt = buildRemoveBackgroundPrompt(input.prompt);
  const task = createTask({
    userId: input.userId,
    type: "remove_background",
    prompt,
    tool: "remove_background",
    provider: provider.name
  });

  await insertTaskWithCreditCheck(task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderStep(task, "remove_background", () =>
      provider.removeBackground({
        taskId: task.id,
        image: input.image,
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
    userId: input.userId,
    type: input.type,
    prompt: input.prompt,
    tool: input.tool,
    provider: provider.name
  });

  await insertTaskWithCreditCheck(task);

  startBackgroundTask(task, async () => {
    await saveTaskInput(task, input.image);

    const generated = await runProviderStep(task, input.type, () =>
      provider.editImage({
        taskId: task.id,
        image: input.image,
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
  userId: string;
  image: File;
  prompt?: string;
  size: ImageSize;
  quality: ImageQuality;
}) {
  return runPromptedImageEditTask({
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
  userId: string;
  image: File;
  prompt?: string;
  size: ImageSize;
  quality: ImageQuality;
}) {
  return runPromptedImageEditTask({
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
      await recoverTaskResultIfPresent(ownedTask.id);
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
