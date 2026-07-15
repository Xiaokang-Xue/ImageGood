import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { loadEnvFiles } from "./load-env.mjs";

interface ProbeDefinition {
  group: "页面" | "接口";
  name: string;
  pathname: string;
  expectedStatuses: number[];
}

interface ProbeResult extends ProbeDefinition {
  status: number | null;
  ok: boolean;
  ttfbMs: number | null;
  totalMs: number | null;
  bytes: number | null;
  error: string | null;
}

const probes: ProbeDefinition[] = [
  { group: "页面", name: "首页", pathname: "/", expectedStatuses: [200] },
  { group: "页面", name: "登录", pathname: "/login", expectedStatuses: [200] },
  { group: "页面", name: "注册", pathname: "/register", expectedStatuses: [200] },
  { group: "页面", name: "价格页", pathname: "/pricing", expectedStatuses: [200] },
  { group: "页面", name: "AI 修图", pathname: "/editor", expectedStatuses: [200] },
  { group: "页面", name: "文生图", pathname: "/text-to-image", expectedStatuses: [200] },
  { group: "页面", name: "智能抠图", pathname: "/remove-background", expectedStatuses: [200] },
  { group: "页面", name: "图片增强", pathname: "/image-enhancer", expectedStatuses: [200] },
  { group: "页面", name: "去杂物", pathname: "/object-remover", expectedStatuses: [200] },
  { group: "页面", name: "商品图", pathname: "/product", expectedStatuses: [200] },
  { group: "页面", name: "封面海报", pathname: "/poster", expectedStatuses: [200] },
  { group: "接口", name: "验证码", pathname: "/api/captcha", expectedStatuses: [200] },
  { group: "接口", name: "积分套餐", pathname: "/api/billing/packages", expectedStatuses: [200] },
  { group: "接口", name: "未登录用户信息保护", pathname: "/api/auth/me", expectedStatuses: [401] },
  { group: "接口", name: "未登录历史记录保护", pathname: "/api/tasks?page=1&limit=1", expectedStatuses: [401] },
  { group: "接口", name: "未登录后台保护", pathname: "/api/admin/analytics", expectedStatuses: [401] }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const value = (prefix: string) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const samplesValue = Number(value("--samples=") || "3");

  return {
    baseUrl: value("--base-url=") || process.env.QUALITY_BASELINE_BASE_URL || "http://127.0.0.1:3000",
    output: value("--output="),
    samples: Number.isInteger(samplesValue) && samplesValue >= 1 && samplesValue <= 10 ? samplesValue : 3,
    withData: args.includes("--with-data")
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "请求超时";
    return error.message.split("\n")[0].slice(0, 160);
  }
  return String(error).slice(0, 160);
}

async function runSingleProbe(url: URL) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent": "ImageGood-Quality-Baseline/1.0"
    }
  });
  const headersAt = performance.now();
  const body = await response.arrayBuffer();
  const completedAt = performance.now();

  return {
    status: response.status,
    ttfbMs: Math.round(headersAt - startedAt),
    totalMs: Math.round(completedAt - startedAt),
    bytes: body.byteLength
  };
}

async function runProbe(baseUrl: URL, definition: ProbeDefinition, samples: number): Promise<ProbeResult> {
  const url = new URL(definition.pathname, baseUrl);
  const timings: Array<{ status: number; ttfbMs: number; totalMs: number; bytes: number }> = [];

  try {
    await runSingleProbe(url).catch(() => null);
    for (let index = 0; index < samples; index += 1) {
      timings.push(await runSingleProbe(url));
    }

    const latest = timings[timings.length - 1];
    return {
      ...definition,
      status: latest.status,
      ok: timings.every((item) => definition.expectedStatuses.includes(item.status)),
      ttfbMs: median(timings.map((item) => item.ttfbMs)),
      totalMs: median(timings.map((item) => item.totalMs)),
      bytes: median(timings.map((item) => item.bytes)),
      error: null
    };
  } catch (error) {
    return {
      ...definition,
      status: null,
      ok: false,
      ttfbMs: null,
      totalMs: null,
      bytes: null,
      error: safeErrorMessage(error)
    };
  }
}

function formatBytes(value: number | null) {
  if (value === null) return "-";
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCny(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

function runtimeSummary() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  return {
    database: /^mysql2?:\/\//i.test(databaseUrl) ? "MySQL" : "本地文件",
    imageMode: process.env.IMAGE_API_MODE || "未配置",
    imageProvider: process.env.IMAGE_PROVIDER || "未配置",
    storage: process.env.IMAGE_STORAGE_PROVIDER || (process.env.TENCENT_COS_ENABLED === "true" ? "cos" : "local"),
    paymentMode: process.env.PAYMENT_MODE || "未配置"
  };
}

async function loadDataBaseline(enabled: boolean) {
  if (!enabled) return null;
  const { getDailyAnalyticsReport } = await import("../src/lib/server/analytics/daily-analytics");
  return getDailyAnalyticsReport({ range: "today" });
}

function renderMarkdown(input: {
  baseUrl: URL;
  samples: number;
  results: ProbeResult[];
  data: Awaited<ReturnType<typeof loadDataBaseline>>;
}) {
  const now = new Date();
  const measuredAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "long",
    timeStyle: "medium",
    hour12: false
  }).format(now);
  const runtime = runtimeSummary();
  const failed = input.results.filter((result) => !result.ok);
  const lines = [
    "# ImageGood 质量基线",
    "",
    `- 测量时间：${measuredAt}（北京时间）`,
    `- 目标地址：${input.baseUrl.origin}`,
    `- 每项采样：预热 1 次 + 正式采样 ${input.samples} 次，中位数计入结果`,
    `- 总体结果：${failed.length === 0 ? "全部通过" : `${failed.length} 项异常`}`,
    "",
    "## 运行配置摘要",
    "",
    "这里只显示配置类型，不输出数据库地址、密钥、手机号或邮箱。",
    "",
    "| 配置 | 当前值 |",
    "| --- | --- |",
    `| 数据存储 | ${runtime.database} |`,
    `| 图片模式 | ${runtime.imageMode} |`,
    `| 图片 Provider | ${runtime.imageProvider} |`,
    `| 图片文件存储 | ${runtime.storage} |`,
    `| 支付模式 | ${runtime.paymentMode} |`,
    "",
    "## 页面与接口可用性",
    "",
    "TTFB 为收到响应头的耗时，整体耗时包含响应体读取。开发模式首次编译不计入正式采样。",
    "",
    "| 类型 | 检查项 | 路径 | 状态 | TTFB | 整体耗时 | 响应大小 | 结果 |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...input.results.map(
      (result) =>
        `| ${result.group} | ${result.name} | \`${result.pathname}\` | ${result.status ?? "-"} | ${result.ttfbMs ?? "-"} ms | ${result.totalMs ?? "-"} ms | ${formatBytes(result.bytes)} | ${result.ok ? "通过" : `异常：${result.error || "状态码不符合预期"}`} |`
    )
  ];

  if (input.data) {
    lines.push(
      "",
      "## 今日与累计业务基线",
      "",
      `统计日期：${input.data.date}，数据库仅执行只读汇总。`,
      "",
      "| 指标 | 今日 | 累计 |",
      "| --- | ---: | ---: |",
      `| 注册用户 | ${input.data.users.newUsers} | ${input.data.cumulative.users.totalUsers} |`,
      `| 图片任务 | ${input.data.images.tasks} | ${input.data.cumulative.images.totalTasks} |`,
      `| 图片任务成功率 | ${formatPercent(input.data.images.successRate)} | ${formatPercent(input.data.cumulative.images.successRate)} |`,
      `| 支付成功订单 | ${input.data.payments.paidOrders} | ${input.data.cumulative.payments.paidOrders} |`,
      `| 支付金额 | ${formatCny(input.data.payments.revenueCents)} | ${formatCny(input.data.cumulative.payments.revenueCents)} |`,
      `| 待支付订单 | ${input.data.payments.pendingOrders} | ${input.data.cumulative.payments.pendingOrders} |`,
      `| 页面访问次数 | ${input.data.traffic.pageViews} | ${input.data.cumulative.traffic.pageViews} |`
    );
  } else {
    lines.push(
      "",
      "## 业务数据说明",
      "",
      "本次未读取数据库。需要业务汇总时，在服务器显式增加 `--with-data`，该模式只读取汇总数据，不修改用户、任务、订单或积分。"
    );
  }

  lines.push(
    "",
    "## 当前风险与后续顺序",
    "",
    "1. 图片生成依赖异步任务、模型服务、COS、数据库和积分流水，应优先补充 taskId 全链路日志。",
    "2. 目前缺少自动化测试脚本，下一步应建立不消耗积分的核心页面冒烟测试。",
    "3. 移动端图片来源复杂，应建立 JPG、PNG、WebP、HEIC、大图和异常文件测试矩阵。",
    "4. 支付回调已有服务端校验逻辑，仍需补充重复通知、金额不一致和积分幂等回归测试。",
    "5. 本基线只反映指定环境和测量时刻，部署方式或网络变化后应重新执行。",
    ""
  );

  return lines.join("\n");
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();
  const baseUrl = new URL(args.baseUrl.endsWith("/") ? args.baseUrl : `${args.baseUrl}/`);
  const results: ProbeResult[] = [];

  console.log(`[baseline] checking ${baseUrl.origin} with ${args.samples} samples per item`);
  for (const definition of probes) {
    const result = await runProbe(baseUrl, definition, args.samples);
    results.push(result);
    console.log(`[baseline] ${result.ok ? "OK" : "FAIL"} ${definition.pathname} status=${result.status ?? "-"} total=${result.totalMs ?? "-"}ms`);
  }

  const data = await loadDataBaseline(args.withData);
  const markdown = renderMarkdown({ baseUrl, samples: args.samples, results, data });

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown, "utf-8");
    console.log(`[baseline] report written: ${path.relative(process.cwd(), outputPath)}`);
  } else {
    console.log("\n" + markdown);
  }

  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[baseline] failed:", safeErrorMessage(error));
  process.exit(1);
});
