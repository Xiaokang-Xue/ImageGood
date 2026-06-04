import { randomUUID } from "crypto";
import { BillingError } from "@/lib/billing";
import { getDbSnapshot, withDb } from "@/lib/db";
import { queryCodexTaskResult, recoverCodexTaskResult } from "@/lib/server/codex-image-provider";
import { buildEditPrompt, buildPosterPrompt, buildProductPrompt } from "@/lib/server/image-prompt-builder";
import { getImageProviderService } from "@/lib/server/image-provider";
import { normalizeResultImages, saveUploadFile } from "@/lib/server/image-storage";
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
  ProductTemplate
} from "@/types/image";
import type { ImageTaskRecord, ImageTaskType } from "@/types/task";

function nowIso() {
  return new Date().toISOString();
}

function taskLog(message: string, payload: Record<string, unknown>) {
  console.info(`[image-task] ${message}`, payload);
}

function taskErrorLog(message: string, payload: Record<string, unknown>) {
  console.error(`[image-task] ${message}`, payload);
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
}

async function updateTask(taskId: string, patch: Partial<ImageTaskRecord>) {
  await withDb((db) => {
    const task = db.imageTasks.find((item) => item.id === taskId);
    if (!task) return;
    Object.assign(task, patch, { updatedAt: nowIso() });
  });
}

async function failTask(taskId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "生成失败，请稍后重试";

  await withDb((db) => {
    const task = db.imageTasks.find((item) => item.id === taskId);
    if (!task || task.status === "succeeded") return;
    task.status = "failed";
    task.errorMessage = message;
    task.updatedAt = nowIso();
  });
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

    if (!alreadyCharged) {
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
        reason: "图片生成",
        createdAt: now
      });
    } else {
      task.creditCharged = true;
    }

    return { task, latestCredits: user.credits };
  });
}

async function recoverTaskResultIfPresent(taskId: string) {
  const snapshot = await getDbSnapshot();
  const task = snapshot.imageTasks.find((item) => item.id === taskId);
  if (!task || task.provider !== "codex") return null;

  const recovered = (await queryCodexTaskResult(task.id)) || (await recoverCodexTaskResult(task.id));
  if (!recovered) return null;

  const saved = await saveResults(task.userId, task.id, [recovered.url]);
  const result = await markTaskSucceeded(task.id, saved);
  taskLog("recovered result from codex workdir", {
    taskId: task.id,
    userId: task.userId,
    sourcePath: recovered.sourcePath,
    resultImageUrl: saved.resultImageUrl,
    latestCredits: result.latestCredits
  });
  return result.task;
}

function startBackgroundTask(task: ImageTaskRecord, runner: () => Promise<void>) {
  void (async () => {
    const startedAt = Date.now();
    taskLog("start", {
      taskId: task.id,
      userId: task.userId,
      type: task.type,
      provider: task.provider,
      startedAt: new Date(startedAt).toISOString()
    });

    try {
      await updateTask(task.id, { status: "processing" });
      await runner();
      taskLog("finished", {
        taskId: task.id,
        elapsedMs: Date.now() - startedAt
      });
    } catch (error) {
      const recovered = await recoverTaskResultIfPresent(task.id);
      if (recovered) return;

      await failTask(task.id, error);
      taskErrorLog("failed", {
        taskId: task.id,
        userId: task.userId,
        type: task.type,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
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
    const inputImageUrl = await saveUploadFile(input.image, input.userId, task.id);
    await updateTask(task.id, { inputImageUrl });

    const generated = await provider.editImage({
      taskId: task.id,
      image: input.image,
      prompt,
      size: input.size,
      quality: input.quality,
      outputFormat: input.outputFormat
    });
    const saved = await saveResults(input.userId, task.id, [generated.url]);
    const result = await markTaskSucceeded(task.id, saved);

    taskLog("succeeded", {
      taskId: task.id,
      userId: input.userId,
      type: task.type,
      resultImageUrl: saved.resultImageUrl,
      latestCredits: result.latestCredits,
      creditCharged: true
    });
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
    const inputImageUrl = await saveUploadFile(input.image, input.userId, task.id);
    await updateTask(task.id, { inputImageUrl });

    const generated = await provider.editImage({
      taskId: task.id,
      image: input.image,
      prompt,
      size: input.size,
      quality: "auto",
      outputFormat: "png"
    });
    const saved = await saveResults(input.userId, task.id, [generated.url]);
    const result = await markTaskSucceeded(task.id, saved);

    taskLog("succeeded", {
      taskId: task.id,
      userId: input.userId,
      type: task.type,
      resultImageUrl: saved.resultImageUrl,
      latestCredits: result.latestCredits,
      creditCharged: true
    });
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
    const generated = await provider.generateImage({
      taskId: task.id,
      prompt,
      size: input.size,
      quality: "auto",
      outputFormat: "png"
    });
    const saved = await saveResults(input.userId, task.id, [generated.url]);
    const result = await markTaskSucceeded(task.id, saved);

    taskLog("succeeded", {
      taskId: task.id,
      userId: input.userId,
      type: task.type,
      resultImageUrl: saved.resultImageUrl,
      latestCredits: result.latestCredits,
      creditCharged: true
    });
  });

  return startResponse(task);
}

export async function listUserTasks(userId: string) {
  const db = await getDbSnapshot();
  return db.imageTasks
    .filter((task) => task.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getUserTask(userId: string, taskId: string) {
  const initial = await getDbSnapshot();
  const ownedTask = initial.imageTasks.find((task) => task.userId === userId && task.id === taskId);
  if (!ownedTask) return null;

  if (ownedTask.status !== "succeeded" || !ownedTask.resultImages?.length) {
    await recoverTaskResultIfPresent(ownedTask.id);
  }

  const db = await getDbSnapshot();
  return db.imageTasks.find((task) => task.userId === userId && task.id === taskId) || null;
}
