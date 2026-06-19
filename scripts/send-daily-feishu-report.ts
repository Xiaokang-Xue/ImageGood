import { loadEnvFiles } from "./load-env.mjs";

type DailyReportRange = "today" | "yesterday";

function parseArgs() {
  const args = process.argv.slice(2);
  const dateArg = args.find((arg) => arg.startsWith("--date="));
  const rangeArg = args.find((arg) => arg === "--today" || arg === "--yesterday");

  return {
    date: dateArg ? dateArg.slice("--date=".length) : undefined,
    range: rangeArg === "--today" ? "today" : rangeArg === "--yesterday" ? "yesterday" : undefined
  } satisfies { date?: string; range?: DailyReportRange };
}

async function main() {
  loadEnvFiles();

  const [{ getDailyAnalyticsReport }, { formatFeishuDailyReport }, { sendFeishuTextMessage }] = await Promise.all([
    import("../src/lib/server/analytics/daily-analytics"),
    import("../src/lib/server/analytics/format-feishu-daily-report"),
    import("../src/lib/server/feishu/feishu-bot")
  ]);

  const args = parseArgs();
  const envRange = process.env.FEISHU_DAILY_REPORT_RANGE === "today" ? "today" : "yesterday";
  const range = args.range || envRange;

  const report = await getDailyAnalyticsReport({
    date: args.date,
    range
  });
  const text = formatFeishuDailyReport(report);

  console.log(`[ops] preparing ImageGood daily report date=${report.date} range=${report.range}`);
  await sendFeishuTextMessage(text);
  console.log("[ops] Feishu daily report sent successfully.");
}

main().catch((error) => {
  console.error("[ops] failed to send Feishu daily report:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
