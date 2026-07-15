interface SmokeCheck {
  group: "page" | "public_api" | "access_control";
  name: string;
  pathname: string;
  expectedStatus: number;
  bodyIncludes?: string;
  validateJson?: (payload: unknown) => boolean;
}

interface SmokeResult extends SmokeCheck {
  ok: boolean;
  status: number | null;
  durationMs: number;
  detail: string;
}

const checks: SmokeCheck[] = [
  { group: "page", name: "首页", pathname: "/", expectedStatus: 200, bodyIncludes: "ImageGood" },
  { group: "page", name: "登录", pathname: "/login", expectedStatus: 200, bodyIncludes: "登录" },
  { group: "page", name: "注册", pathname: "/register", expectedStatus: 200 },
  { group: "page", name: "价格页", pathname: "/pricing", expectedStatus: 200, bodyIncludes: "积分包" },
  { group: "page", name: "AI 修图", pathname: "/editor", expectedStatus: 200, bodyIncludes: "上传图片" },
  { group: "page", name: "文生图", pathname: "/text-to-image", expectedStatus: 200, bodyIncludes: "文生图" },
  { group: "page", name: "智能抠图", pathname: "/remove-background", expectedStatus: 200, bodyIncludes: "智能抠图" },
  { group: "page", name: "图片增强", pathname: "/image-enhancer", expectedStatus: 200, bodyIncludes: "图片增强" },
  { group: "page", name: "去杂物", pathname: "/object-remover", expectedStatus: 200, bodyIncludes: "去杂物" },
  { group: "page", name: "商品图", pathname: "/product", expectedStatus: 200, bodyIncludes: "商品图" },
  { group: "page", name: "封面海报", pathname: "/poster", expectedStatus: 200, bodyIncludes: "封面" },
  {
    group: "public_api",
    name: "算术验证码接口",
    pathname: "/api/captcha",
    expectedStatus: 200,
    validateJson: (payload) =>
      Boolean(payload && typeof payload === "object" && "question" in payload && typeof payload.question === "string")
  },
  {
    group: "public_api",
    name: "积分套餐接口",
    pathname: "/api/billing/packages",
    expectedStatus: 200,
    validateJson: (payload) =>
      Boolean(payload && typeof payload === "object" && "packages" in payload && Array.isArray(payload.packages) && payload.packages.length > 0)
  },
  { group: "access_control", name: "当前用户接口保护", pathname: "/api/auth/me", expectedStatus: 401 },
  { group: "access_control", name: "历史记录接口保护", pathname: "/api/tasks?page=1&limit=1", expectedStatus: 401 },
  { group: "access_control", name: "管理员看板接口保护", pathname: "/api/admin/analytics", expectedStatus: 401 }
];

function readArg(prefix: string) {
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function safeError(error: unknown) {
  if (error instanceof Error) return error.message.split("\n")[0].slice(0, 180);
  return String(error).slice(0, 180);
}

async function runCheck(baseUrl: URL, check: SmokeCheck, timeoutMs: number): Promise<SmokeResult> {
  const startedAt = performance.now();

  try {
    const response = await fetch(new URL(check.pathname, baseUrl), {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: check.group === "page" ? "text/html" : "application/json",
        "User-Agent": "ImageGood-Smoke-Test/1.0"
      }
    });
    const body = await response.text();
    const statusMatches = response.status === check.expectedStatus;
    let contentMatches = true;
    let contentDetail = "";

    if (check.bodyIncludes) {
      contentMatches = body.includes(check.bodyIncludes);
      contentDetail = contentMatches ? "" : `，响应未包含“${check.bodyIncludes}”`;
    }

    if (check.validateJson) {
      try {
        contentMatches = check.validateJson(JSON.parse(body));
        contentDetail = contentMatches ? "" : "，JSON 结构不符合预期";
      } catch {
        contentMatches = false;
        contentDetail = "，响应不是有效 JSON";
      }
    }

    return {
      ...check,
      ok: statusMatches && contentMatches,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      detail: statusMatches ? contentDetail || "符合预期" : `期望 ${check.expectedStatus}，实际 ${response.status}`
    };
  } catch (error) {
    return {
      ...check,
      ok: false,
      status: null,
      durationMs: Math.round(performance.now() - startedAt),
      detail: safeError(error)
    };
  }
}

function groupLabel(group: SmokeCheck["group"]) {
  if (group === "page") return "核心页面";
  if (group === "public_api") return "公开接口";
  return "权限边界";
}

async function main() {
  const baseUrlValue = readArg("--base-url=") || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
  const timeoutMs = parsePositiveInteger(readArg("--timeout-ms=") || process.env.SMOKE_TIMEOUT_MS, 30_000);
  const baseUrl = new URL(baseUrlValue.endsWith("/") ? baseUrlValue : `${baseUrlValue}/`);

  console.info(`[smoke] target=${baseUrl.origin} checks=${checks.length} timeoutMs=${timeoutMs}`);

  const results: SmokeResult[] = [];
  for (const check of checks) {
    const result = await runCheck(baseUrl, check, timeoutMs);
    results.push(result);
    const status = result.status === null ? "-" : String(result.status);
    console.info(`${result.ok ? "PASS" : "FAIL"}  ${groupLabel(result.group)} / ${result.name}  status=${status}  ${result.durationMs}ms  ${result.detail}`);
  }

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  console.info(`[smoke] completed passed=${passed} failed=${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`[smoke] fatal: ${safeError(error)}`);
  process.exit(1);
});
