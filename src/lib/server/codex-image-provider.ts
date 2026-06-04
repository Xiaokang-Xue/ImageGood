import type { ImageProviderService, ProviderEditInput, ProviderGenerateInput } from "@/lib/server/image-provider";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

interface CodexJobPayload {
  ok?: boolean;
  jobId?: string;
  status?: "pending" | "processing" | "succeeded" | "failed" | string;
  resultPath?: string | null;
  resultFileSize?: number | null;
  errorCode?: string | null;
  message?: string | null;
  stdoutTail?: string | null;
  stderrTail?: string | null;
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function getCodexApiBaseUrl() {
  return (process.env.CODEX_IMAGE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

function getCodexWorkDir() {
  return process.env.CODEX_IMAGE_API_WORKDIR || "/data/codex_image_api_runs";
}

function getCodexApiTimeoutMs() {
  const seconds = Number(process.env.CODEX_IMAGE_API_TIMEOUT_SECONDS || "900");
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 900_000;
}

function getResultGraceMs() {
  const seconds = Number(process.env.CODEX_RESULT_GRACE_SECONDS || "900");
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 900_000;
}

function imageLooksValid(buffer: Buffer) {
  return (
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") ||
    buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
    buffer.subarray(0, 6).toString("ascii") === "GIF89a"
  );
}

async function latestImageFile(root: string): Promise<string | null> {
  const candidates: Array<{ filePath: string; mtimeMs: number }> = [];

  async function walk(directory: string) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(filePath);
          return;
        }

        const lowerName = entry.name.toLowerCase();
        if (lowerName.startsWith("reference_") || lowerName.startsWith("input.")) return;
        if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return;

        try {
          const fileStat = await stat(filePath);
          if (fileStat.size > 0) {
            candidates.push({ filePath, mtimeMs: fileStat.mtimeMs });
          }
        } catch {
          // Ignore files that disappear while scanning.
        }
      })
    );
  }

  await walk(root);
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.filePath ?? null;
}

export async function recoverCodexTaskResult(taskId: string) {
  const safeTaskId = safePathSegment(taskId);
  if (!safeTaskId) return null;

  const taskDir = path.join(getCodexWorkDir(), "tasks", safeTaskId);
  const preferredPath = path.join(taskDir, "result.png");
  let imagePath = preferredPath;

  try {
    const fileStat = await stat(preferredPath);
    if (!fileStat.isFile() || fileStat.size <= 0) {
      imagePath = (await latestImageFile(taskDir)) || preferredPath;
    }
  } catch {
    imagePath = (await latestImageFile(taskDir)) || preferredPath;
  }

  try {
    const buffer = await readFile(imagePath);
    if (!imageLooksValid(buffer)) return null;
    return {
      url: imagePath,
      sourcePath: imagePath
    };
  } catch {
    return null;
  }
}

async function parseCodexJson(response: Response): Promise<CodexJobPayload> {
  const text = await response.text().catch(() => "");
  if (!text) {
    return {
      ok: false,
      status: "failed",
      errorCode: "EMPTY_RESPONSE",
      message: `图片服务返回空响应，HTTP ${response.status}`
    };
  }

  try {
    return JSON.parse(text) as CodexJobPayload;
  } catch {
    return {
      ok: false,
      status: "failed",
      errorCode: "INVALID_RESPONSE",
      message: text
    };
  }
}

function jobMessage(payload: CodexJobPayload) {
  return (
    payload.message ||
    payload.errorCode ||
    payload.stderrTail ||
    payload.stdoutTail ||
    "图片处理失败，请稍后重试"
  );
}

async function queryCodexJob(taskId: string): Promise<CodexJobPayload | null> {
  try {
    const response = await fetch(`${getCodexApiBaseUrl()}/v1/jobs/${encodeURIComponent(taskId)}`);
    if (!response.ok) return null;
    return parseCodexJson(response);
  } catch {
    return null;
  }
}

function resultFromJob(payload: CodexJobPayload) {
  if (payload.status === "succeeded" && payload.resultPath) {
    return { url: payload.resultPath };
  }
  return null;
}

export async function queryCodexTaskResult(taskId: string) {
  const payload = await queryCodexJob(taskId);
  const result = payload ? resultFromJob(payload) : null;
  if (!result) return null;
  return {
    url: result.url,
    sourcePath: result.url
  };
}

async function waitForCodexTaskResult(taskId: string, originalError?: unknown) {
  const startedAt = Date.now();
  let lastPayload: CodexJobPayload | null = null;

  while (Date.now() - startedAt <= getResultGraceMs()) {
    lastPayload = await queryCodexJob(taskId);
    const remoteResult = lastPayload ? resultFromJob(lastPayload) : null;
    if (remoteResult) {
      console.warn("[image-task] recovered codex result from job api", {
        taskId,
        resultPath: remoteResult.url,
        originalError: originalError instanceof Error ? originalError.message : originalError ? String(originalError) : null
      });
      return remoteResult;
    }

    const localResult = await recoverCodexTaskResult(taskId);
    if (localResult) {
      console.warn("[image-task] recovered codex result from workdir", {
        taskId,
        sourcePath: localResult.sourcePath,
        originalError: originalError instanceof Error ? originalError.message : originalError ? String(originalError) : null
      });
      return { url: localResult.url };
    }

    if (lastPayload?.status === "failed") {
      throw new Error(jobMessage(lastPayload));
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (lastPayload?.status === "failed") {
    throw new Error(jobMessage(lastPayload));
  }

  if (originalError instanceof DOMException && originalError.name === "AbortError") {
    throw new Error("图片生成仍在处理中，请稍后在历史记录中查看结果");
  }
  if (originalError instanceof Error) {
    throw originalError;
  }
  throw new Error("图片处理超时，请稍后重试");
}

async function requestCodexJob(endpoint: string, init: RequestInit, taskId?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getCodexApiTimeoutMs());

  try {
    const response = await fetch(`${getCodexApiBaseUrl()}${endpoint}`, {
      ...init,
      signal: controller.signal
    });
    const payload = await parseCodexJson(response);

    if (!response.ok || !payload.ok) {
      const recovered = taskId ? await waitForCodexTaskResult(taskId, new Error(jobMessage(payload))) : null;
      if (recovered) return recovered;
      throw new Error(jobMessage(payload));
    }

    const result = resultFromJob(payload);
    if (!result) {
      throw new Error("图片服务未返回可用的生成结果");
    }

    return result;
  } catch (error) {
    if (taskId) {
      return waitForCodexTaskResult(taskId, error);
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("图片生成仍在处理中，请稍后在历史记录中查看结果");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createCodexImageProvider(): ImageProviderService {
  return {
    name: "codex",
    editImage(input: ProviderEditInput) {
      const formData = new FormData();
      formData.append("prompt", input.prompt);
      formData.append("jobId", input.taskId || "");
      formData.append("image", input.image, input.image.name || "reference.png");

      return requestCodexJob(
        "/v1/jobs/reference",
        {
          method: "POST",
          body: formData
        },
        input.taskId
      );
    },
    generateImage(input: ProviderGenerateInput) {
      return requestCodexJob(
        "/v1/jobs/text",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prompt: input.prompt, jobId: input.taskId })
        },
        input.taskId
      );
    }
  };
}
