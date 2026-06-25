import { NextResponse } from "next/server";
import { getDbSnapshot } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { AdminAnalyticsResponse } from "@/types/analytics";

export const runtime = "nodejs";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(input: string | null | undefined) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function lastDays(days: number) {
  const keys: string[] = [];
  const today = startOfToday();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    keys.push(date.toISOString().slice(0, 10));
  }
  return keys;
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

function pageFeatureLabel(path: string) {
  const pathname = path.split("?")[0] || "/";
  if (pathname === "/") return "首页";
  if (pathname.startsWith("/editor")) return "智能修图";
  if (pathname.startsWith("/text-to-image")) return "文生图";
  if (pathname.startsWith("/remove-background")) return "智能抠图";
  if (pathname.startsWith("/product")) return "商品图生成";
  if (pathname.startsWith("/poster")) return "封面海报生成";
  if (pathname.startsWith("/pricing")) return "积分购买页";
  if (pathname.startsWith("/checkout")) return "支付结账页";
  if (pathname.startsWith("/login")) return "登录页";
  if (pathname.startsWith("/register")) return "注册页";
  if (pathname.startsWith("/history")) return "历史记录";
  if (pathname.startsWith("/account")) return "账户中心";
  if (pathname.startsWith("/templates")) return "模板中心";
  if (pathname.startsWith("/admin")) return "管理员后台";
  return "其他页面";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "没有管理员权限" } }, { status: 403 });
  }

  const db = await getDbSnapshot({ includeAnalytics: true });
  const today = startOfToday();
  const todayKey = today.toISOString().slice(0, 10);
  const paidOrders = db.orders.filter((order) => order.status === "paid");
  const pendingOrders = db.orders.filter((order) => order.status === "pending");
  const pendingOrderUsers = new Set(pendingOrders.map((order) => order.userId)).size;
  const succeededTasks = db.imageTasks.filter((task) => task.status === "succeeded");
  const failedTasks = db.imageTasks.filter((task) => task.status === "failed");
  const pageViews = db.analyticsEvents.filter((event) => event.type === "page_view");
  const purchaseClicks = db.analyticsEvents.filter((event) => event.type === "purchase_click");
  const acquisitionEvents = db.analyticsEvents.filter((event) => event.type === "acquisition_channel");
  const todayPageViews = pageViews.filter((event) => new Date(event.createdAt).getTime() >= today.getTime());
  const uniqueVisitors = new Set(pageViews.map((event) => event.visitorId)).size;
  const purchaseClickUsers = new Set(purchaseClicks.map(eventIdentity)).size;
  const pricingPageViews = pageViews.filter((event) => pathStartsWith(event.path, ["/pricing"]));
  const checkoutPageViews = pageViews.filter((event) => pathStartsWith(event.path, ["/checkout"]));
  const generationPageViews = pageViews.filter((event) =>
    pathStartsWith(event.path, ["/editor", "/text-to-image", "/remove-background", "/product", "/poster"])
  );
  const activeCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
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
    pageViews: pageViews.filter((event) => dateKey(event.createdAt) === key).length,
    purchaseClicks: purchaseClicks.filter((event) => dateKey(event.createdAt) === key).length,
    registrations: db.users.filter((item) => dateKey(item.createdAt) === key).length,
    paidOrders: paidOrders.filter((order) => dateKey(order.paidAt) === key).length,
    revenueCents: paidOrders
      .filter((order) => dateKey(order.paidAt) === key)
      .reduce((sum, order) => sum + order.amountCents, 0),
    succeededTasks: succeededTasks.filter((task) => dateKey(task.updatedAt) === key).length
  }));

  const pageMap = new Map<string, { label: string; paths: Set<string>; views: number; visitors: Set<string> }>();
  for (const event of pageViews) {
    const label = pageFeatureLabel(event.path);
    const current = pageMap.get(label) ?? { label, paths: new Set<string>(), views: 0, visitors: new Set<string>() };
    current.views += 1;
    current.paths.add(event.path.split("?")[0] || "/");
    current.visitors.add(event.visitorId);
    pageMap.set(label, current);
  }

  const topPages = [...pageMap.entries()]
    .map(([, item]) => ({
      path: [...item.paths][0] || "",
      label: item.label,
      views: item.views,
      uniqueVisitors: item.visitors.size
    }))
    .sort((left, right) => right.views - left.views)
    .slice(0, 8);

  const channelMap = new Map<string, number>();
  for (const event of acquisitionEvents) {
    const channel = String(event.target || event.metadata?.channel || "其他").trim() || "其他";
    channelMap.set(channel, (channelMap.get(channel) ?? 0) + 1);
  }
  const acquisitionChannels = [...channelMap.entries()]
    .map(([channel, count]) => ({ channel, count }))
    .sort((left, right) => right.count - left.count);

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

  const response: AdminAnalyticsResponse = {
    overview: {
      totalPageViews: pageViews.length,
      todayPageViews: todayPageViews.length,
      uniqueVisitors,
      totalUsers: db.users.length,
      todayRegistrations: db.users.filter((item) => dateKey(item.createdAt) === todayKey).length,
      verifiedUsers: db.users.filter((item) => item.emailVerified || item.phoneVerified).length,
      totalTasks: db.imageTasks.length,
      succeededTasks: succeededTasks.length,
      failedTasks: failedTasks.length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      pendingOrderUsers,
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
      todayRevenueCents: paidOrders
        .filter((order) => dateKey(order.paidAt) === todayKey)
        .reduce((sum, order) => sum + order.amountCents, 0),
      creditsConsumed
    },
    daily,
    topPages,
    acquisitionChannels,
    recentPaidOrders
  };

  return NextResponse.json(response);
}
