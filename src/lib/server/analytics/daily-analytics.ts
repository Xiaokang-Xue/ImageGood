import { readFile } from "fs/promises";
import path from "path";

type DailyReportRange = "today" | "yesterday";

type DbRecordCollection = "users" | "orders" | "imageTasks" | "creditTransactions" | "analyticsEvents" | "analyticsDailySummaries";

interface StoredUser {
  id: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt?: string;
}

interface StoredOrder {
  id: string;
  userId: string;
  status: "pending" | "paid" | "cancelled" | "expired" | "failed";
  amountCents?: number;
  credits?: number;
  paymentProvider?: "wechat" | "alipay" | "manual";
  createdAt?: string;
  paidAt?: string | null;
  updatedAt?: string;
}

interface StoredImageTask {
  id: string;
  userId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  createdAt?: string;
  updatedAt?: string;
}

interface StoredCreditTransaction {
  id: string;
  type: "grant" | "consume" | "purchase" | "refund" | "admin_adjust";
  amount: number;
  createdAt?: string;
}

interface StoredAnalyticsEvent {
  id: string;
  type: "page_view" | "purchase_click" | "acquisition_channel";
  path: string;
  visitorId: string;
  userId?: string | null;
  createdAt?: string;
}

interface StoredAnalyticsDailySummary {
  id: string;
  date: string;
  pageViews: number;
  pricingPageViews: number;
  checkoutPageViews: number;
  generationPageViews: number;
  purchaseClicks: number;
  acquisitionChannels: number;
  createdAt?: string;
  updatedAt?: string;
}

interface AnalyticsDatabase {
  users: StoredUser[];
  orders: StoredOrder[];
  imageTasks: StoredImageTask[];
  creditTransactions: StoredCreditTransaction[];
  analyticsEvents: StoredAnalyticsEvent[];
  analyticsDailySummaries: StoredAnalyticsDailySummary[];
}

export interface DailyAnalyticsReport {
  date: string;
  range: DailyReportRange;
  startAt: string;
  endAt: string;
  users: {
    newUsers: number;
    totalUsers: number;
    verifiedUsers: number;
    activeUsers: number;
    activeVisitors: number;
  };
  images: {
    tasks: number;
    succeeded: number;
    failed: number;
    successRate: number;
    creditsConsumed: number;
  };
  payments: {
    paidOrders: number;
    payingUsers: number;
    repeatPurchaseUsers: number;
    repeatPurchaseRate: number;
    revenueCents: number;
    purchasedCredits: number;
    wechatPaidOrders: number;
    alipayPaidOrders: number;
    pendingOrders: number;
    pendingOrderUsers: number;
    purchaseClicks: number;
  };
  content: {
    newHistoryRecords: number;
  };
  traffic: {
    pageViews: number;
    pricingPageViews: number;
    checkoutPageViews: number;
    generationPageViews: number;
  };
  cumulative: {
    users: {
      totalUsers: number;
      verifiedUsers: number;
    };
    images: {
      totalTasks: number;
      succeeded: number;
      failed: number;
      successRate: number;
      creditsConsumed: number;
    };
    payments: {
      paidOrders: number;
      payingUsers: number;
      repeatPurchaseUsers: number;
      repeatPurchaseRate: number;
      revenueCents: number;
      purchasedCredits: number;
      wechatPaidOrders: number;
      alipayPaidOrders: number;
      pendingOrders: number;
      pendingOrderUsers: number;
      purchaseClicks: number;
    };
    content: {
      historyRecords: number;
    };
    traffic: {
      pageViews: number;
      pricingPageViews: number;
      checkoutPageViews: number;
      generationPageViews: number;
    };
  };
}

const COLLECTIONS: DbRecordCollection[] = [
  "users",
  "orders",
  "imageTasks",
  "creditTransactions",
  "analyticsEvents",
  "analyticsDailySummaries"
];

function databaseUrl() {
  return process.env.DATABASE_URL || "file:./dev.db";
}

function isMysqlDatabaseUrl(value = databaseUrl()) {
  return /^mysql2?:\/\//i.test(value);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function resolveReportWindow(input: { date?: string; range?: DailyReportRange }) {
  const range: DailyReportRange = input.range === "today" ? "today" : "yesterday";
  let start: Date;

  if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    const [year, month, day] = input.date.split("-").map(Number);
    start = new Date(year, month - 1, day);
  } else {
    start = startOfLocalDay(new Date());
    if (range === "yesterday") {
      start.setDate(start.getDate() - 1);
    }
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    date: localDateKey(start),
    range,
    start,
    end
  };
}

function inRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function pathStartsWith(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`));
}

interface TrafficCounts {
  pageViews: number;
  pricingPageViews: number;
  checkoutPageViews: number;
  generationPageViews: number;
  purchaseClicks: number;
  acquisitionChannels: number;
}

function emptyTrafficCounts(): TrafficCounts {
  return {
    pageViews: 0,
    pricingPageViews: 0,
    checkoutPageViews: 0,
    generationPageViews: 0,
    purchaseClicks: 0,
    acquisitionChannels: 0
  };
}

function eventDateKey(event: StoredAnalyticsEvent) {
  return event.createdAt ? localDateKey(new Date(event.createdAt)) : "";
}

function addTrafficCounts(target: TrafficCounts, delta: TrafficCounts) {
  target.pageViews += delta.pageViews;
  target.pricingPageViews += delta.pricingPageViews;
  target.checkoutPageViews += delta.checkoutPageViews;
  target.generationPageViews += delta.generationPageViews;
  target.purchaseClicks += delta.purchaseClicks;
  target.acquisitionChannels += delta.acquisitionChannels;
}

function maxTrafficCounts(left: TrafficCounts, right: TrafficCounts): TrafficCounts {
  return {
    pageViews: Math.max(left.pageViews, right.pageViews),
    pricingPageViews: Math.max(left.pricingPageViews, right.pricingPageViews),
    checkoutPageViews: Math.max(left.checkoutPageViews, right.checkoutPageViews),
    generationPageViews: Math.max(left.generationPageViews, right.generationPageViews),
    purchaseClicks: Math.max(left.purchaseClicks, right.purchaseClicks),
    acquisitionChannels: Math.max(left.acquisitionChannels, right.acquisitionChannels)
  };
}

function eventTrafficDelta(event: StoredAnalyticsEvent, generationPaths: string[]): TrafficCounts {
  const delta = emptyTrafficCounts();
  if (event.type === "page_view") {
    delta.pageViews += 1;
    if (pathStartsWith(event.path, ["/pricing"])) delta.pricingPageViews += 1;
    if (pathStartsWith(event.path, ["/checkout"])) delta.checkoutPageViews += 1;
    if (pathStartsWith(event.path, generationPaths)) delta.generationPageViews += 1;
  } else if (event.type === "purchase_click") {
    delta.purchaseClicks += 1;
  } else if (event.type === "acquisition_channel") {
    delta.acquisitionChannels += 1;
  }
  return delta;
}

function summaryTrafficCounts(summary: StoredAnalyticsDailySummary): TrafficCounts {
  return {
    pageViews: summary.pageViews,
    pricingPageViews: summary.pricingPageViews,
    checkoutPageViews: summary.checkoutPageViews,
    generationPageViews: summary.generationPageViews,
    purchaseClicks: summary.purchaseClicks,
    acquisitionChannels: summary.acquisitionChannels
  };
}

function buildTrafficCounters(db: AnalyticsDatabase, generationPaths: string[]) {
  const summaryByDate = new Map<string, TrafficCounts>();
  const retainedByDate = new Map<string, TrafficCounts>();
  const byDate = new Map<string, TrafficCounts>();
  const total = emptyTrafficCounts();

  for (const summary of db.analyticsDailySummaries) {
    const current = summaryByDate.get(summary.date) ?? emptyTrafficCounts();
    addTrafficCounts(current, summaryTrafficCounts(summary));
    summaryByDate.set(summary.date, current);
  }

  for (const event of db.analyticsEvents) {
    const date = eventDateKey(event);
    if (!date) continue;
    const current = retainedByDate.get(date) ?? emptyTrafficCounts();
    addTrafficCounts(current, eventTrafficDelta(event, generationPaths));
    retainedByDate.set(date, current);
  }

  const dates = new Set([...summaryByDate.keys(), ...retainedByDate.keys()]);
  for (const date of dates) {
    const merged = maxTrafficCounts(summaryByDate.get(date) ?? emptyTrafficCounts(), retainedByDate.get(date) ?? emptyTrafficCounts());
    byDate.set(date, merged);
    addTrafficCounts(total, merged);
  }

  return { byDate, total };
}

function paidOrderTime(order: StoredOrder) {
  const value = order.paidAt || order.updatedAt || order.createdAt;
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function repeatPurchaseMetrics(orders: StoredOrder[]) {
  const orderCountByUser = new Map<string, number>();
  for (const order of orders) {
    orderCountByUser.set(order.userId, (orderCountByUser.get(order.userId) ?? 0) + 1);
  }

  const payingUsers = orderCountByUser.size;
  const repeatPurchaseUsers = [...orderCountByUser.values()].filter((count) => count >= 2).length;

  return {
    payingUsers,
    repeatPurchaseUsers,
    repeatPurchaseRate: payingUsers > 0 ? repeatPurchaseUsers / payingUsers : 0
  };
}

function emptyAnalyticsDatabase(): AnalyticsDatabase {
  return {
    users: [],
    orders: [],
    imageTasks: [],
    creditTransactions: [],
    analyticsEvents: [],
    analyticsDailySummaries: []
  };
}

function parseMysqlJsonRecord(value: unknown) {
  if (typeof value === "string") return JSON.parse(value);
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf-8"));
  return value;
}

async function readMysqlAnalyticsDatabase(): Promise<AnalyticsDatabase> {
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection({
    uri: databaseUrl(),
    charset: "utf8mb4",
    dateStrings: true
  });

  try {
    const placeholders = COLLECTIONS.map(() => "?").join(", ");
    const [rows] = await connection.query(
      `SELECT collection, record FROM imagegood_records WHERE collection IN (${placeholders})`,
      COLLECTIONS
    );
    const data = emptyAnalyticsDatabase();

    for (const row of rows as Array<{ collection?: unknown; record?: unknown }>) {
      const collection = String(row.collection || "") as DbRecordCollection;
      if (!COLLECTIONS.includes(collection)) continue;
      const record = parseMysqlJsonRecord(row.record);
      if (record && typeof record === "object") {
        (data[collection] as unknown[]).push(record);
      }
    }

    return data;
  } finally {
    await connection.end();
  }
}

async function readFileAnalyticsDatabase(): Promise<AnalyticsDatabase> {
  const value = databaseUrl();
  const filePath = value.startsWith("file:") ? value.slice("file:".length) : value;
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = await readFile(resolved, "utf-8");
  const parsed = JSON.parse(raw || "{}") as Partial<AnalyticsDatabase>;

  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    imageTasks: Array.isArray(parsed.imageTasks) ? parsed.imageTasks : [],
    creditTransactions: Array.isArray(parsed.creditTransactions) ? parsed.creditTransactions : [],
    analyticsEvents: Array.isArray(parsed.analyticsEvents) ? parsed.analyticsEvents : [],
    analyticsDailySummaries: Array.isArray(parsed.analyticsDailySummaries)
      ? parsed.analyticsDailySummaries.map((summary: StoredAnalyticsDailySummary) => ({
          id: summary.id || summary.date,
          date: summary.date || summary.id,
          pageViews: Number(summary.pageViews || 0),
          pricingPageViews: Number(summary.pricingPageViews || 0),
          checkoutPageViews: Number(summary.checkoutPageViews || 0),
          generationPageViews: Number(summary.generationPageViews || 0),
          purchaseClicks: Number(summary.purchaseClicks || 0),
          acquisitionChannels: Number(summary.acquisitionChannels || 0),
          createdAt: summary.createdAt,
          updatedAt: summary.updatedAt
        }))
      : []
  };
}

async function readAnalyticsDatabase() {
  return isMysqlDatabaseUrl() ? readMysqlAnalyticsDatabase() : readFileAnalyticsDatabase();
}

export async function getDailyAnalyticsReport(input: {
  date?: string;
  range?: DailyReportRange;
} = {}): Promise<DailyAnalyticsReport> {
  const { date, range, start, end } = resolveReportWindow(input);
  const db = await readAnalyticsDatabase();

  const allPageViews = db.analyticsEvents.filter((event) => event.type === "page_view");
  const allPurchaseClicks = db.analyticsEvents.filter((event) => event.type === "purchase_click");
  const allPricingPageViews = allPageViews.filter((event) => pathStartsWith(event.path, ["/pricing"]));
  const allCheckoutPageViews = allPageViews.filter((event) => pathStartsWith(event.path, ["/checkout"]));
  const generationPaths = ["/editor", "/text-to-image", "/remove-background", "/image-enhancer", "/object-remover", "/product", "/poster"];
  const allGenerationPageViews = allPageViews.filter((event) => pathStartsWith(event.path, generationPaths));
  const trafficCounters = buildTrafficCounters(db, generationPaths);
  const rangeTraffic = trafficCounters.byDate.get(date) ?? emptyTrafficCounts();
  const allSucceededTasks = db.imageTasks.filter((task) => task.status === "succeeded");
  const allFailedTasks = db.imageTasks.filter((task) => task.status === "failed");
  const allCreditsConsumed = db.creditTransactions
    .filter((transaction) => transaction.type === "consume")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const allPaidOrders = db.orders.filter((order) => order.status === "paid");
  const allPendingOrders = db.orders.filter((order) => order.status === "pending");
  const cumulativeRepeatPurchases = repeatPurchaseMetrics(allPaidOrders);

  const pageViews = db.analyticsEvents.filter((event) => event.type === "page_view" && inRange(event.createdAt, start, end));
  const purchaseClicks = db.analyticsEvents.filter(
    (event) => event.type === "purchase_click" && inRange(event.createdAt, start, end)
  );
  const pricingPageViews = pageViews.filter((event) => pathStartsWith(event.path, ["/pricing"]));
  const checkoutPageViews = pageViews.filter((event) => pathStartsWith(event.path, ["/checkout"]));
  const generationPageViews = pageViews.filter((event) => pathStartsWith(event.path, generationPaths));

  const tasksInRange = db.imageTasks.filter((task) => inRange(task.createdAt, start, end));
  const succeededTasks = tasksInRange.filter((task) => task.status === "succeeded");
  const failedTasks = tasksInRange.filter((task) => task.status === "failed");
  const creditsConsumed = db.creditTransactions
    .filter((transaction) => transaction.type === "consume" && inRange(transaction.createdAt, start, end))
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const paidOrders = db.orders.filter((order) => order.status === "paid" && inRange(order.paidAt || order.updatedAt, start, end));
  const pendingOrders = db.orders.filter((order) => order.status === "pending" && inRange(order.createdAt, start, end));
  const paidUserIdsInRange = new Set(paidOrders.map((order) => order.userId));
  const paidOrdersThroughPeriodEnd = allPaidOrders.filter((order) => {
    const time = paidOrderTime(order);
    return Number.isFinite(time) && time < end.getTime();
  });
  const orderCountThroughPeriodEnd = new Map<string, number>();
  for (const order of paidOrdersThroughPeriodEnd) {
    orderCountThroughPeriodEnd.set(order.userId, (orderCountThroughPeriodEnd.get(order.userId) ?? 0) + 1);
  }
  const repeatPurchaseUsersInRange = [...paidUserIdsInRange].filter(
    (userId) => (orderCountThroughPeriodEnd.get(userId) ?? 0) >= 2
  ).length;

  return {
    date,
    range,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    users: {
      newUsers: db.users.filter((user) => inRange(user.createdAt, start, end)).length,
      totalUsers: db.users.length,
      verifiedUsers: db.users.filter((user) => user.emailVerified || user.phoneVerified).length,
      activeUsers: new Set(pageViews.map((event) => event.userId).filter(Boolean)).size,
      activeVisitors: new Set(pageViews.map((event) => event.visitorId).filter(Boolean)).size
    },
    images: {
      tasks: tasksInRange.length,
      succeeded: succeededTasks.length,
      failed: failedTasks.length,
      successRate: tasksInRange.length > 0 ? succeededTasks.length / tasksInRange.length : 0,
      creditsConsumed
    },
    payments: {
      paidOrders: paidOrders.length,
      payingUsers: paidUserIdsInRange.size,
      repeatPurchaseUsers: repeatPurchaseUsersInRange,
      repeatPurchaseRate: paidUserIdsInRange.size > 0 ? repeatPurchaseUsersInRange / paidUserIdsInRange.size : 0,
      revenueCents: paidOrders.reduce((sum, order) => sum + (order.amountCents || 0), 0),
      purchasedCredits: paidOrders.reduce((sum, order) => sum + (order.credits || 0), 0),
      wechatPaidOrders: paidOrders.filter((order) => order.paymentProvider === "wechat").length,
      alipayPaidOrders: paidOrders.filter((order) => order.paymentProvider === "alipay").length,
      pendingOrders: pendingOrders.length,
      pendingOrderUsers: new Set(pendingOrders.map((order) => order.userId)).size,
      purchaseClicks: rangeTraffic.purchaseClicks || purchaseClicks.length
    },
    content: {
      newHistoryRecords: succeededTasks.length
    },
    traffic: {
      pageViews: rangeTraffic.pageViews || pageViews.length,
      pricingPageViews: rangeTraffic.pricingPageViews || pricingPageViews.length,
      checkoutPageViews: rangeTraffic.checkoutPageViews || checkoutPageViews.length,
      generationPageViews: rangeTraffic.generationPageViews || generationPageViews.length
    },
    cumulative: {
      users: {
        totalUsers: db.users.length,
        verifiedUsers: db.users.filter((user) => user.emailVerified || user.phoneVerified).length
      },
      images: {
        totalTasks: db.imageTasks.length,
        succeeded: allSucceededTasks.length,
        failed: allFailedTasks.length,
        successRate: db.imageTasks.length > 0 ? allSucceededTasks.length / db.imageTasks.length : 0,
        creditsConsumed: allCreditsConsumed
      },
      payments: {
        paidOrders: allPaidOrders.length,
        payingUsers: cumulativeRepeatPurchases.payingUsers,
        repeatPurchaseUsers: cumulativeRepeatPurchases.repeatPurchaseUsers,
        repeatPurchaseRate: cumulativeRepeatPurchases.repeatPurchaseRate,
        revenueCents: allPaidOrders.reduce((sum, order) => sum + (order.amountCents || 0), 0),
        purchasedCredits: allPaidOrders.reduce((sum, order) => sum + (order.credits || 0), 0),
        wechatPaidOrders: allPaidOrders.filter((order) => order.paymentProvider === "wechat").length,
        alipayPaidOrders: allPaidOrders.filter((order) => order.paymentProvider === "alipay").length,
        pendingOrders: allPendingOrders.length,
        pendingOrderUsers: new Set(allPendingOrders.map((order) => order.userId)).size,
        purchaseClicks: trafficCounters.total.purchaseClicks || allPurchaseClicks.length
      },
      content: {
        historyRecords: allSucceededTasks.length
      },
      traffic: {
        pageViews: trafficCounters.total.pageViews || allPageViews.length,
        pricingPageViews: trafficCounters.total.pricingPageViews || allPricingPageViews.length,
        checkoutPageViews: trafficCounters.total.checkoutPageViews || allCheckoutPageViews.length,
        generationPageViews: trafficCounters.total.generationPageViews || allGenerationPageViews.length
      }
    }
  };
}
