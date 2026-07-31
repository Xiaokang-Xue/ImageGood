import { createHash } from "crypto";
import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import { loadEnvFiles } from "./load-env.mjs";
import type { StoredImageTaskRecord } from "../src/lib/db";

type ExportStatus = "complete" | "partial" | "failed";

interface ExportRow {
  userKey: string;
  taskId: string;
  taskType: string;
  createdAt: string;
  status: ExportStatus;
  inputFile: string;
  resultFiles: string[];
  error: string;
}

function argumentValue(name: string) {
  return process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseLimit(value: string | undefined) {
  if (value?.toLowerCase() === "all") return Number.POSITIVE_INFINITY;
  return parsePositiveInteger(value, 200);
}

function parseBoundary(value: string | undefined, endOfDay: boolean) {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59.999+08:00" : "T00:00:00.000+08:00";
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}${suffix}`) : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`日期格式无效：${value}`);
  return timestamp;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function anonymousUserKey(userId: string) {
  return `user-${createHash("sha256").update(userId).digest("hex").slice(0, 12)}`;
}

function beijingTimestamp(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "00";
  return `${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}${part("second")}`;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "png";
}

async function nonEmptyFileExists(filename: string) {
  try {
    return (await stat(filename)).size > 0;
  } catch {
    return false;
  }
}

async function writeImage(filename: string, buffer: Buffer) {
  if (await nonEmptyFileExists(filename)) return "existing";
  await writeFile(filename, buffer);
  return "written";
}

function resultReferences(task: StoredImageTaskRecord) {
  const cleanResults = (task.originalResultImages || []).filter(Boolean);
  const visibleResults = (task.resultImages || []).filter(Boolean);
  const candidates = cleanResults.length > 0 ? cleanResults : visibleResults.length > 0 ? visibleResults : [task.resultImageUrl || ""];
  return [...new Set(candidates.filter(Boolean))];
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function manifestCsv(rows: ExportRow[]) {
  const header = ["anonymous_user", "task_id", "task_type", "created_at", "status", "input_file", "result_files", "error"];
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.userKey,
        row.taskId,
        row.taskType,
        row.createdAt,
        row.status,
        row.inputFile,
        row.resultFiles.join("|"),
        row.error
      ]
        .map(csvCell)
        .join(",")
    )
  ].join("\n");
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

async function exportTask(
  task: StoredImageTaskRecord,
  outputRoot: string,
  readStoredTaskImage: (reference: string, taskId: string) => Promise<{ buffer: Buffer; mimeType: string }>
): Promise<ExportRow> {
  const userKey = anonymousUserKey(task.userId);
  const relativeDirectory = path.join(
    "users",
    userKey,
    `${beijingTimestamp(task.createdAt)}_${safeSegment(task.type)}_${safeSegment(task.id)}`
  );
  const taskDirectory = path.join(outputRoot, relativeDirectory);
  await mkdir(taskDirectory, { recursive: true });

  const errors: string[] = [];
  let inputFile = "";
  const resultFiles: string[] = [];

  try {
    const input = await readStoredTaskImage(task.inputImageUrl || "", task.id);
    inputFile = path.join(relativeDirectory, `input.${extensionForMimeType(input.mimeType)}`);
    await writeImage(path.join(outputRoot, inputFile), input.buffer);
  } catch (error) {
    errors.push(`input: ${safeError(error)}`);
  }

  const references = resultReferences(task);
  for (let index = 0; index < references.length; index += 1) {
    try {
      const result = await readStoredTaskImage(references[index], task.id);
      const relativeFile = path.join(
        relativeDirectory,
        `result-${String(index + 1).padStart(2, "0")}.${extensionForMimeType(result.mimeType)}`
      );
      await writeImage(path.join(outputRoot, relativeFile), result.buffer);
      resultFiles.push(relativeFile);
    } catch (error) {
      errors.push(`result-${index + 1}: ${safeError(error)}`);
    }
  }

  const status: ExportStatus =
    inputFile && resultFiles.length > 0 ? "complete" : inputFile || resultFiles.length > 0 ? "partial" : "failed";
  await writeFile(
    path.join(taskDirectory, "metadata.json"),
    JSON.stringify(
      {
        anonymousUser: userKey,
        taskId: task.id,
        taskType: task.type,
        tool: task.tool || null,
        prompt: task.prompt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        exportStatus: status,
        inputFile: inputFile ? path.basename(inputFile) : null,
        resultFiles: resultFiles.map((filename) => path.basename(filename)),
        errors
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    userKey,
    taskId: task.id,
    taskType: task.type,
    createdAt: task.createdAt,
    status,
    inputFile,
    resultFiles,
    error: errors.join("; ")
  };
}

async function mapConcurrent<T, Result>(
  values: T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<Result>
) {
  const results = new Array<Result>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await operation(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  loadEnvFiles();
  if (process.argv.includes("--help")) {
    console.info(
      [
        "Usage: npm run ops:export-image-pairs -- [options]",
        "",
        "Options:",
        "  --output=/data/imagegood_analysis/image-pairs",
        "  --limit=200|all",
        "  --since=YYYY-MM-DD",
        "  --until=YYYY-MM-DD",
        "  --concurrency=3"
      ].join("\n")
    );
    return;
  }

  const outputRoot = path.resolve(argumentValue("--output") || path.join("exports", "image-pairs"));
  const limit = parseLimit(argumentValue("--limit"));
  const concurrency = Math.min(parsePositiveInteger(argumentValue("--concurrency"), 3), 8);
  const since = parseBoundary(argumentValue("--since"), false);
  const until = parseBoundary(argumentValue("--until"), true);

  if (outputRoot === path.parse(outputRoot).root || outputRoot === path.resolve(".")) {
    throw new Error("导出目录不能是磁盘根目录或项目根目录");
  }

  const [{ getDbSnapshot }, { readStoredTaskImage }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/server/image-storage")
  ]);
  const db = await getDbSnapshot();
  const candidates = db.imageTasks
    .filter((task) => {
      const createdAt = Date.parse(task.createdAt);
      return (
        task.status === "succeeded" &&
        Boolean(task.inputImageUrl) &&
        resultReferences(task).length > 0 &&
        (since === null || createdAt >= since) &&
        (until === null || createdAt <= until)
      );
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);

  await mkdir(outputRoot, { recursive: true });
  console.info(
    `[image-pair-export] tasks=${candidates.length} concurrency=${concurrency} output=${outputRoot} mode=read-only`
  );

  let completed = 0;
  const rows = await mapConcurrent(candidates, concurrency, async (task) => {
    const row = await exportTask(task, outputRoot, readStoredTaskImage);
    completed += 1;
    console.info(`[image-pair-export] ${completed}/${candidates.length} task=${task.id} status=${row.status}`);
    return row;
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    outputRoot,
    selectedTasks: candidates.length,
    complete: rows.filter((row) => row.status === "complete").length,
    partial: rows.filter((row) => row.status === "partial").length,
    failed: rows.filter((row) => row.status === "failed").length,
    filters: {
      limit: Number.isFinite(limit) ? limit : "all",
      since: argumentValue("--since") || null,
      until: argumentValue("--until") || null
    }
  };
  await Promise.all([
    writeFile(path.join(outputRoot, "manifest.csv"), `\uFEFF${manifestCsv(rows)}`, "utf8"),
    writeFile(path.join(outputRoot, "summary.json"), JSON.stringify(summary, null, 2), "utf8")
  ]);

  console.info(
    `[image-pair-export] done complete=${summary.complete} partial=${summary.partial} failed=${summary.failed}`
  );
}

main().catch((error) => {
  console.error(`[image-pair-export] failed: ${safeError(error)}`);
  process.exit(1);
});
