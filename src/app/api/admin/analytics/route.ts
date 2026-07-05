import { NextResponse } from "next/server";
import { getDbSnapshot } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type {
  AdminAnalyticsResponse,
  AnalyticsEventRecord,
  AnalyticsFunnelRange,
  AnalyticsFunnelStep
} from "@/types/analytics";
import type { OrderRecord } from "@/types/billing";

export const runtime = "nodejs";

const ANALYTICS_CACHE_MS = 30_000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const analyticsCache = new Map<string, { expiresAt: number; response: AdminAnalyticsResponse }>();

function beijingDateKey(input: string | number | Date | null | undefined) {
  if (input === null || input === undefined || input === "") return "";
  const timestamp = input instanceof Date ? input.getTime() : typeof input === "number" ? input : new Date(input).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function beijingDayStartMs(dateKey: string) {
  return Date.parse(`${dateKey}T00:00:00+08:00`);
}

function lastDays(days: number) {
  const keys: string[] = [];
  const todayStart = beijingDayStartMs(beijingDateKey(Date.now()));
  for (let index = days - 1; index >= 0; index -= 1) {
    keys.push(beijingDateKey(todayStart - index * DAY_MS));
  }
  return keys;
}

function parseFunnelRange(value: string | null): AnalyticsFunnelRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "all") return value;
  return "all";
}

function funnelRangeLabel(range: AnalyticsFunnelRange) {
  if (range === "today") return "今日";
  if (range === "7d") return "近 7 天";
  if (range === "30d") return "近 30 天";
  return "全部历史";
}

function funnelRangeStart(range: AnalyticsFunnelRange, todayKey: string) {
  const todayStart = beijingDayStartMs(todayKey);
  if (range === "today") return todayStart;
  if (range === "7d") return todayStart - 6 * DAY_MS;
  if (range === "30d") return todayStart - 29 * DAY_MS;
  return null;
}

function isInRange(input: string | null | undefined, startMs: number | null) {
  if (!input) return false;
  const timestamp = new Date(input).getTime();
  return Number.isFinite(timestamp) && (startMs === null || timestamp >= startMs);
}

function eventIdentity(event: { userId?: string | null; visitorId: string }) {
  return event.userId || event.visitorId;
}

function pathStartsWith(path: string, prefixes: string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

function displayUser(user?: { email?: string | null; phone?: string | null; name?: string | null }) {
  if (!user) return "未知用户";
  if (user.email) return user.email;
  if (user.phone) return user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
  return user.name || "未知用户";
}

function taskTypeLabel(type: string) {
  const labels: Record<string, string> = {
    edit: "AI 修图",
    text_to_image: "文生图",
    remove_background: "智能抠图",
    image_enhance: "图片增强",
    object_remove: "去杂物",
    product: "商品图",
    poster: "封面海报"
  };
  return labels[type] || "其他任务";
}

function repeatPurchaseMetrics(orders: Array<{ userId: string }>) {
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

function buildConversionFunnel(input: {
  events: AnalyticsEventRecord[];
  orders: OrderRecord[];
  range: AnalyticsFunnelRange;
  todayKey: string;
}): AnalyticsFunnelStep[] {
  const rangeStart = funnelRangeStart(input.range, input.todayKey);
  const visitorToUser = new Map<string, string>();
  for (const event of input.events) {
    if (event.userId) visitorToUser.set(event.visitorId, event.userId);
  }

  const identityForEvent = (event: AnalyticsEventRecord) =>
    event.userId
      ? `user:${event.userId}`
      : visitorToUser.has(event.visitorId)
        ? `user:${visitorToUser.get(event.visitorId)}`
        : `visitor:${event.visitorId}`;

  const eventsInRange = input.events.filter((event) => isInRange(event.createdAt, rangeStart));
  const firstEventTimes = (events: AnalyticsEventRecord[]) => {
    const result = new Map<string, number>();
    for (const event of events) {
      const timestamp = new Date(event.createdAt).getTime();
      if (!Number.isFinite(timestamp)) continue;
      const identity = identityForEvent(event);
      const current = result.get(identity);
      if (current === undefined || timestamp < current) result.set(identity, timestamp);
    }
    return result;
  };
  const convertedAfter = (from: Map<string, number>, to: Map<string, number>) => {
    let converted = 0;
    for (const [identity, fromTime] of from) {
      const toTime = to.get(identity);
      if (toTime !== undefined && toTime >= fromTime) converted += 1;
    }
    return converted;
  };
  const makeStep = (
    id: string,
    group: AnalyticsFunnelStep["group"],
    fromLabel: string,
    toLabel: string,
    fromUsers: number,
    toUsers: number,
    description: string
  ): AnalyticsFunnelStep => {
    const safeToUsers = Math.min(fromUsers, toUsers);
    return {
      id,
      group,
      fromLabel,
      toLabel,
      fromUsers,
      toUsers: safeToUsers,
      conversionRate: fromUsers > 0 ? safeToUsers / fromUsers : 0,
      dropOffUsers: Math.max(0, fromUsers - safeToUsers),
      description
    };
  };

  const pageViews = eventsInRange.filter((event) => event.type === "page_view");
  const homepageViews = firstEventTimes(pageViews.filter((event) => event.path.split("?")[0] === "/"));
  const toolViews = firstEventTimes(
    pageViews.filter((event) =>
      pathStartsWith(event.path, [
        "/editor",
        "/text-to-image",
        "/remove-background",
        "/image-enhancer",
        "/object-remover",
        "/product",
        "/poster"
      ])
    )
  );

  const pricingViews = firstEventTimes(
    pageViews.filter((event) => pathStartsWith(event.path, ["/pricing"]))
  );
  const ordersInRange = input.orders.filter((order) => isInRange(order.createdAt, rangeStart));
  const firstOrderTimes = new Map<string, number>();
  for (const order of ordersInRange) {
    const identity = `user:${order.userId}`;
    const timestamp = new Date(order.createdAt).getTime();
    const current = firstOrderTimes.get(identity);
    if (Number.isFinite(timestamp) && (current === undefined || timestamp < current)) {
      firstOrderTimes.set(identity, timestamp);
    }
  }
  const orderCreators = new Set(ordersInRange.map((order) => order.userId));
  const paidOrderUsers = new Set(
    ordersInRange.filter((order) => order.status === "paid").map((order) => order.userId)
  );

  const paidOrdersByUser = new Map<string, OrderRecord[]>();
  for (const order of input.orders) {
    if (order.status !== "paid" || !order.paidAt) continue;
    const list = paidOrdersByUser.get(order.userId) ?? [];
    list.push(order);
    paidOrdersByUser.set(order.userId, list);
  }
  let firstPayUsers = 0;
  let repeatPayUsers = 0;
  for (const orders of paidOrdersByUser.values()) {
    orders.sort((left, right) => new Date(left.paidAt || 0).getTime() - new Date(right.paidAt || 0).getTime());
    if (!isInRange(orders[0]?.paidAt, rangeStart)) continue;
    firstPayUsers += 1;
    if (orders.length >= 2) repeatPayUsers += 1;
  }

  return [
    makeStep(
      "home_to_tool",
      "activation",
      "访问首页",
      "进入工具",
      homepageViews.size,
      convertedAfter(homepageViews, toolViews),
      "同一访问者进入首页后，继续打开任一图片工具"
    ),
    makeStep(
      "pricing_to_order",
      "payment",
      "查看价格页",
      "创建订单",
      pricingViews.size,
      convertedAfter(pricingViews, firstOrderTimes),
      "同一用户查看价格页后创建任意积分订单"
    ),
    makeStep(
      "order_to_paid",
      "payment",
      "创建订单",
      "支付成功",
      orderCreators.size,
      paidOrderUsers.size,
      "按创建订单的去重用户统计当前支付结果"
    ),
    makeStep(
      "first_paid_to_repeat",
      "retention",
      "首次付费",
      "再次购买",
      firstPayUsers,
      repeatPayUsers,
      "该周期首次付费用户中，当前已经完成第二次购买的人数"
    )
  ];
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "没有管理员权限" } }, { status: 403 });
  }

  const url = new URL(request.url);
  const range = parseFunnelRange(url.searchParams.get("range"));
  const todayKey = beijingDateKey(Date.now());
  const cacheKey = `${todayKey}:${range}`;
  const cached = analyticsCache.get(cacheKey);
  if (url.searchParams.get("refresh") !== "1" && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.response, {
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  const db = await getDbSnapshot({ includeAnalytics: true });
  const paidOrders = db.orders.filter((order) => order.status === "paid");
  const repeatPurchases = repeatPurchaseMetrics(paidOrders);
  const pendingOrders = db.orders.filter((order) => order.status === "pending");
  const todayCreatedOrders = db.orders.filter((order) => beijingDateKey(order.createdAt) === todayKey);
  const todayPendingOrders = todayCreatedOrders.filter((order) => order.status === "pending");
  const todayPaidOrders = paidOrders.filter((order) => beijingDateKey(order.paidAt) === todayKey);
  const pendingOrderUsers = new Set(pendingOrders.map((order) => order.userId)).size;
  const succeededTasks = db.imageTasks.filter((task) => task.status === "succeeded");
  const failedTasks = db.imageTasks.filter((task) => task.status === "failed");
  const todayTasks = db.imageTasks.filter((task) => beijingDateKey(task.createdAt) === todayKey);
  const todaySucceededTasks = todayTasks.filter((task) => task.status === "succeeded");
  const pageViews = db.analyticsEvents.filter((event) => event.type === "page_view");
  const purchaseClicks = db.analyticsEvents.filter((event) => event.type === "purchase_click");
  const acquisitionEvents = db.analyticsEvents.filter((event) => event.type === "acquisition_channel");
  const todayPageViews = pageViews.filter((event) => beijingDateKey(event.createdAt) === todayKey);
  const uniqueVisitors = new Set(pageViews.map((event) => event.visitorId)).size;
  const purchaseClickUsers = new Set(purchaseClicks.map(eventIdentity)).size;
  const pricingPageViews = pageViews.filter((event) => pathStartsWith(event.path, ["/pricing"]));
  const checkoutPageViews = pageViews.filter((event) => pathStartsWith(event.path, ["/checkout"]));
  const generationPageViews = pageViews.filter((event) =>
    pathStartsWith(event.path, ["/editor", "/text-to-image", "/remove-background", "/image-enhancer", "/object-remover", "/product", "/poster"])
  );
  const activeCutoff = funnelRangeStart("7d", todayKey) ?? Date.now() - 7 * DAY_MS;
  const activeUserEvents7d = pageViews.filter((event) => {
    if (!event.userId) return false;
    return new Date(event.createdAt).getTime() >= activeCutoff;
  });
  const todayActiveUserEvents = todayPageViews.filter((event) => event.userId);
  const creditsConsumed = db.creditTransactions
    .filter((transaction) => transaction.type === "consume")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const dayKeys = lastDays(60);
  const daily = dayKeys.map((key) => ({
    date: key,
    pageViews: pageViews.filter((event) => beijingDateKey(event.createdAt) === key).length,
    purchaseClicks: purchaseClicks.filter((event) => beijingDateKey(event.createdAt) === key).length,
    registrations: db.users.filter((item) => beijingDateKey(item.createdAt) === key).length,
    paidOrders: paidOrders.filter((order) => beijingDateKey(order.paidAt) === key).length,
    revenueCents: paidOrders
      .filter((order) => beijingDateKey(order.paidAt) === key)
      .reduce((sum, order) => sum + order.amountCents, 0),
    succeededTasks: succeededTasks.filter((task) => beijingDateKey(task.updatedAt) === key).length
  }));

  const channelMap = new Map<string, number>();
  for (const event of acquisitionEvents) {
    const channel = String(event.target || event.metadata?.channel || "其他").trim() || "其他";
    channelMap.set(channel, (channelMap.get(channel) ?? 0) + 1);
  }
  const acquisitionChannels = [...channelMap.entries()]
    .map(([channel, count]) => ({ channel, count }))
    .sort((left, right) => right.count - left.count);

  const taskTypeMap = new Map<string, { type: string; label: string; total: number; succeeded: number }>();
  for (const task of db.imageTasks) {
    const current = taskTypeMap.get(task.type) ?? {
      type: task.type,
      label: taskTypeLabel(task.type),
      total: 0,
      succeeded: 0
    };
    current.total += 1;
    if (task.status === "succeeded") {
      current.succeeded += 1;
    }
    taskTypeMap.set(task.type, current);
  }
  const taskTypes = [...taskTypeMap.values()].sort((left, right) => right.total - left.total);

  const recentPaidOrders = paidOrders
    .filter((order) => order.paidAt)
    .sort((left, right) => new Date(right.paidAt || 0).getTime() - new Date(left.paidAt || 0).getTime())
    .slice(0, 6)
    .map((order) => {
      const owner = db.users.find((item) => item.id === order.userId);
      return {
        id: order.id,
        packageName: order.packageName,
        amountCents: order.amountCents,
        credits: order.credits,
        userEmail: displayUser(owner),
        paidAt: order.paidAt || order.updatedAt
      };
    });

  const funnelSteps = buildConversionFunnel({
    events: db.analyticsEvents,
    orders: db.orders,
    range,
    todayKey
  });

  const response: AdminAnalyticsResponse = {
    meta: {
      timezone: "Asia/Shanghai",
      generatedAt: new Date().toISOString(),
      today: todayKey,
      funnelRange: range,
      funnelRangeLabel: funnelRangeLabel(range)
    },
    overview: {
      totalPageViews: pageViews.length,
      todayPageViews: todayPageViews.length,
      todayVisitors: new Set(todayPageViews.map((event) => event.visitorId)).size,
      uniqueVisitors,
      totalUsers: db.users.length,
      todayRegistrations: db.users.filter((item) => beijingDateKey(item.createdAt) === todayKey).length,
      verifiedUsers: db.users.filter((item) => item.emailVerified || item.phoneVerified).length,
      totalTasks: db.imageTasks.length,
      succeededTasks: succeededTasks.length,
      failedTasks: failedTasks.length,
      paidOrders: paidOrders.length,
      payingUsers: repeatPurchases.payingUsers,
      repeatPurchaseUsers: repeatPurchases.repeatPurchaseUsers,
      repeatPurchaseRate: repeatPurchases.repeatPurchaseRate,
      pendingOrders: pendingOrders.length,
      pendingOrderUsers,
      todayPendingOrders: todayPendingOrders.length,
      todayCreatedOrders: todayCreatedOrders.length,
      todayPaidOrders: todayPaidOrders.length,
      purchaseClicks: purchaseClicks.length,
      purchaseClickUsers,
      pricingPageViews: pricingPageViews.length,
      pricingVisitors: new Set(pricingPageViews.map((event) => event.visitorId)).size,
      checkoutPageViews: checkoutPageViews.length,
      checkoutVisitors: new Set(checkoutPageViews.map((event) => event.visitorId)).size,
      generationPageVisitors: new Set(generationPageViews.map((event) => event.visitorId)).size,
      activeUsers7d: new Set(activeUserEvents7d.map((event) => event.userId)).size,
      todayActiveUsers: new Set(todayActiveUserEvents.map((event) => event.userId)).size,
      revenueCents: paidOrders.reduce((sum, order) => sum + order.amountCents, 0),
      todayRevenueCents: todayPaidOrders.reduce((sum, order) => sum + order.amountCents, 0),
      creditsConsumed,
      todayTasks: todayTasks.length,
      todaySucceededTasks: todaySucceededTasks.length,
      todayTaskUsers: new Set(todayTasks.map((task) => task.userId)).size
    },
    funnel: {
      steps: funnelSteps
    },
    daily,
    acquisitionChannels,
    taskTypes,
    recentPaidOrders
  };

  analyticsCache.set(cacheKey, {
    expiresAt: Date.now() + ANALYTICS_CACHE_MS,
    response
  });

  return NextResponse.json(response, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
