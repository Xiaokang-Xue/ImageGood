import "server-only";

import type { ImageProvider } from "@/types/image";
import type { ImageTaskStatus, ImageTaskType } from "@/types/task";

export type ImageTaskLogLevel = "info" | "warn" | "error";

export interface ImageTaskLogContext {
  taskId: string;
  userId?: string;
  taskType?: ImageTaskType;
  provider?: ImageProvider | null;
  status?: ImageTaskStatus;
  stage?: "queue" | "input_storage" | "provider" | "result_storage" | "database" | "cleanup" | "recovery";
  operation?: string;
  durationMs?: number;
  totalDurationMs?: number;
  inputImageCount?: number;
  outputImageCount?: number;
  storageProvider?: "cos" | "local";
  creditCharged?: boolean;
  creditsConsumed?: number;
  latestCredits?: number;
  error?: unknown;
}

function maskedIdentifier(value: string) {
  if (value.length <= 12) return `${value.slice(0, 4)}***`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function safeErrorDetails(error: unknown) {
  const source = error instanceof Error ? error.message : String(error);
  const message = source
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]")
    .replace(/[?&](key|token|secret|signature)=[^&\s]+/gi, "$1=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 500);

  return {
    errorName: error instanceof Error ? error.name : "Error",
    errorMessage: message || "Unknown error"
  };
}

export function logImageTaskEvent(event: string, context: ImageTaskLogContext, level: ImageTaskLogLevel = "info") {
  const { error, userId, ...fields } = context;
  const payload = {
    timestamp: new Date().toISOString(),
    scope: "image_task",
    event,
    ...fields,
    ...(userId ? { userId: maskedIdentifier(userId) } : {}),
    ...(error === undefined ? {} : safeErrorDetails(error))
  };
  const line = `[image-task] ${JSON.stringify(payload)}`;

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
