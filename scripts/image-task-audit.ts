import { loadEnvFiles } from "./load-env.mjs";

function readArg(prefix: string) {
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function durationLabel(durationMs: number) {
  if (durationMs < 1_000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1)}s`;
  return `${(durationMs / 60_000).toFixed(1)}min`;
}

function safeMessage(value: string | null | undefined) {
  return (value || "未记录错误信息").replace(/[\r\n\t]+/g, " ").trim().slice(0, 120);
}

async function main() {
  loadEnvFiles();
  const hours = positiveNumber(readArg("--hours="), 24);
  const staleMinutes = positiveNumber(readArg("--stale-minutes="), 30);
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1_000;
  const staleCutoff = now - staleMinutes * 60 * 1_000;
  const { getDbSnapshot } = await import("../src/lib/db");
  const db = await getDbSnapshot();
  const tasks = db.imageTasks.filter((task) => new Date(task.createdAt).getTime() >= cutoff);
  const succeeded = tasks.filter((task) => task.status === "succeeded");
  const failed = tasks.filter((task) => task.status === "failed");
  const pending = tasks.filter((task) => task.status === "pending");
  const processing = tasks.filter((task) => task.status === "processing");
  const completed = succeeded.length + failed.length;
  const successfulDurations = succeeded
    .map((task) => new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime())
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  const averageDuration = successfulDurations.length
    ? Math.round(successfulDurations.reduce((sum, duration) => sum + duration, 0) / successfulDurations.length)
    : 0;
  const staleTasks = db.imageTasks
    .filter(
      (task) =>
        (task.status === "pending" || task.status === "processing") &&
        new Date(task.updatedAt).getTime() < staleCutoff
    )
    .sort((left, right) => new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime());

  const failureCounts = new Map<string, number>();
  for (const task of failed) {
    const message = safeMessage(task.errorMessage);
    failureCounts.set(message, (failureCounts.get(message) ?? 0) + 1);
  }
  const topFailures = [...failureCounts.entries()]
    .map(([message, count]) => ({ count, message }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  console.info(`[task-audit] range=${hours}h staleThreshold=${staleMinutes}min generatedAt=${new Date(now).toISOString()}`);
  console.info(`任务总数: ${tasks.length}`);
  console.info(`成功: ${succeeded.length}`);
  console.info(`失败: ${failed.length}`);
  console.info(`等待中: ${pending.length}`);
  console.info(`处理中: ${processing.length}`);
  console.info(`完成任务成功率: ${completed > 0 ? percent(succeeded.length / completed) : "暂无完成任务"}`);
  console.info(`成功任务平均耗时: ${successfulDurations.length ? durationLabel(averageDuration) : "暂无数据"}`);
  console.info(`超过 ${staleMinutes} 分钟未更新的进行中任务: ${staleTasks.length}`);

  if (topFailures.length > 0) {
    console.info("\n主要失败原因:");
    for (const failure of topFailures) console.info(`- ${failure.count} 次：${failure.message}`);
  }

  if (staleTasks.length > 0) {
    console.info("\n长期未更新任务:");
    for (const task of staleTasks.slice(0, 20)) {
      const ageMs = Math.max(0, now - new Date(task.updatedAt).getTime());
      console.info(`- taskId=${task.id} type=${task.type} status=${task.status} provider=${task.provider || "unknown"} age=${durationLabel(ageMs)}`);
    }
    if (staleTasks.length > 20) console.info(`- 其余 ${staleTasks.length - 20} 条未展开`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[task-audit] failed: ${message.split("\n")[0].slice(0, 200)}`);
  process.exit(1);
});
