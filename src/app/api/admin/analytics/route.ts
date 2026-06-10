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
  const succeededTasks = db.imageTasks.filter((task) => task.status === "succeeded");
  const failedTasks = db.imageTasks.filter((task) => task.status === "failed");
  const pageViews = db.analyticsEvents.filter((event) => event.type === "page_view");
  const todayPageViews = pageViews.filter((event) => new Date(event.createdAt).getTime() >= today.getTime());
  const uniqueVisitors = new Set(pageViews.map((event) => event.visitorId)).size;
  const creditsConsumed = db.creditTransactions
    .filter((transaction) => transaction.type === "consume")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const dayKeys = lastDays(14);
  const daily = dayKeys.map((key) => ({
    date: key,
    pageViews: pageViews.filter((event) => dateKey(event.createdAt) === key).length,
    registrations: db.users.filter((item) => dateKey(item.createdAt) === key).length,
    paidOrders: paidOrders.filter((order) => dateKey(order.paidAt) === key).length,
    revenueCents: paidOrders
      .filter((order) => dateKey(order.paidAt) === key)
      .reduce((sum, order) => sum + order.amountCents, 0),
    succeededTasks: succeededTasks.filter((task) => dateKey(task.updatedAt) === key).length
  }));

  const pageMap = new Map<string, { views: number; visitors: Set<string> }>();
  for (const event of pageViews) {
    const current = pageMap.get(event.path) ?? { views: 0, visitors: new Set<string>() };
    current.views += 1;
    current.visitors.add(event.visitorId);
    pageMap.set(event.path, current);
  }

  const topPages = [...pageMap.entries()]
    .map(([path, item]) => ({
      path,
      views: item.views,
      uniqueVisitors: item.visitors.size
    }))
    .sort((left, right) => right.views - left.views)
    .slice(0, 8);

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
        userEmail: owner?.email ?? "未知用户",
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
      verifiedUsers: db.users.filter((item) => item.emailVerified).length,
      totalTasks: db.imageTasks.length,
      succeededTasks: succeededTasks.length,
      failedTasks: failedTasks.length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      revenueCents: paidOrders.reduce((sum, order) => sum + order.amountCents, 0),
      todayRevenueCents: paidOrders
        .filter((order) => dateKey(order.paidAt) === todayKey)
        .reduce((sum, order) => sum + order.amountCents, 0),
      creditsConsumed
    },
    daily,
    topPages,
    recentPaidOrders
  };

  return NextResponse.json(response);
}
