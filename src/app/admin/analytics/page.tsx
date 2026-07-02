"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Eye,
  Image as ImageIcon,
  MousePointerClick,
  RefreshCcw,
  Repeat2,
  ShoppingCart,
  UserPlus,
  Users,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageApiClientError, apiClient, getImageErrorMessage, isUnauthorizedError } from "@/lib/api-client";
import type { AdminAnalyticsResponse } from "@/types/analytics";

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}

function percent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    setError("");

    apiClient
      .getAdminAnalytics()
      .then(setData)
      .catch((requestError) => {
        if (isUnauthorizedError(requestError)) {
          setError("请先登录管理员账号");
          return;
        }
        if (requestError instanceof ImageApiClientError && requestError.code === "FORBIDDEN") {
          setError("无权限访问");
          return;
        }
        setError(getImageErrorMessage(requestError) || "服务暂时不可用，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maxDailyPageViews = useMemo(() => {
    return Math.max(1, ...(data?.daily.map((item) => item.pageViews) ?? [1]));
  }, [data]);

  const maxDailyRevenue = useMemo(() => {
    return Math.max(1, ...(data?.daily.map((item) => item.revenueCents) ?? [1]));
  }, [data]);

  const maxDailyPurchaseClicks = useMemo(() => {
    return Math.max(1, ...(data?.daily.map((item) => item.purchaseClicks) ?? [1]));
  }, [data]);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-10 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">管理员</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">运营数据看板</h1>
          <p className="mt-3 text-sm text-muted">
            查看网站访问、注册、生成任务和付费订单的核心指标。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/orders">
            <Button variant="outline">查看订单后台</Button>
          </Link>
          <Button variant="dark" loading={loading} onClick={loadData}>
            <RefreshCcw className="h-4 w-4" />
            刷新数据
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-rose-200 bg-rose-50 p-6">
          <h2 className="text-xl font-bold text-rose-700">{error}</h2>
          <p className="mt-2 text-sm text-rose-600">
            {error === "无权限访问" ? "当前账号不是管理员，无法查看运营数据。" : "请检查登录状态或稍后重试。"}
          </p>
        </Card>
      ) : null}

      {loading ? (
        <Card className="p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-studio-100 border-t-studio-500" />
          <p className="mt-4 text-sm font-semibold text-muted">运营数据加载中…</p>
        </Card>
      ) : data && !error ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Eye}
              label="总访问量"
              value={formatNumber(data.overview.totalPageViews)}
              helper={`今日 ${formatNumber(data.overview.todayPageViews)} 次 · 访客 ${formatNumber(data.overview.uniqueVisitors)} 人`}
            />
            <MetricCard
              icon={Users}
              label="累计已注册用户"
              value={formatNumber(data.overview.totalUsers)}
              helper={`今日新注册 ${formatNumber(data.overview.todayRegistrations)} 人 · 联系方式验证率 ${percent(
                data.overview.verifiedUsers,
                data.overview.totalUsers
              )}`}
            />
            <MetricCard
              icon={ShoppingCart}
              label="付费订单"
              value={formatNumber(data.overview.paidOrders)}
              helper={`今日收入 ${formatCny(data.overview.todayRevenueCents)} · 待付款 ${formatNumber(data.overview.pendingOrders)} 单`}
            />
            <MetricCard
              icon={CreditCard}
              label="累计收入"
              value={formatCny(data.overview.revenueCents)}
              helper={`已消耗积分 ${formatNumber(data.overview.creditsConsumed)} 次`}
            />
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-3">
            <MetricCard
              icon={MousePointerClick}
              label="购买按钮点击"
              value={formatNumber(data.overview.purchaseClicks)}
              helper={`点击用户 ${formatNumber(data.overview.purchaseClickUsers)} 人 · 购买页访客 ${formatNumber(data.overview.pricingVisitors)} 人`}
            />
            <MetricCard
              icon={ShoppingCart}
              label="尝试付款人数"
              value={formatNumber(data.overview.pendingOrderUsers)}
              helper={`待付款订单 ${formatNumber(data.overview.pendingOrders)} 单，用于观察支付转化流失`}
            />
            <MetricCard
              icon={Repeat2}
              label="复购率"
              value={`${(data.overview.repeatPurchaseRate * 100).toFixed(1)}%`}
              helper={`复购用户 ${formatNumber(data.overview.repeatPurchaseUsers)} 人 · 付费用户 ${formatNumber(data.overview.payingUsers)} 人`}
            />
            <MetricCard
              icon={ImageIcon}
              label="生成任务"
              value={formatNumber(data.overview.totalTasks)}
              helper={`成功 ${formatNumber(data.overview.succeededTasks)} · 失败 ${formatNumber(data.overview.failedTasks)}`}
            />
            <MetricCard
              icon={CheckCircle2}
              label="生成成功率"
              value={percent(data.overview.succeededTasks, data.overview.totalTasks)}
              helper="按全部图片任务计算"
            />
            <MetricCard
              icon={UserPlus}
              label="已验证联系方式用户"
              value={formatNumber(data.overview.verifiedUsers)}
              helper="用于评估可生成用户规模"
            />
            <MetricCard
              icon={Activity}
              label="近7日访问过网站的登录用户"
              value={formatNumber(data.overview.activeUsers7d)}
              helper={`今日访问过网站的登录用户 ${formatNumber(data.overview.todayActiveUsers)} 人 · 生成页访问设备 ${formatNumber(data.overview.generationPageVisitors)} 个`}
            />
            <MetricCard
              icon={CreditCard}
              label="结账页访客"
              value={formatNumber(data.overview.checkoutVisitors)}
              helper={`结账页访问 ${formatNumber(data.overview.checkoutPageViews)} 次，用于分析支付页到达率`}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-studio-600">近 60 天趋势</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">访问、注册与付费</h2>
                </div>
                <BarChart3 className="h-5 w-5 text-studio-600" />
              </div>

              <div className="max-h-[620px] overflow-y-auto pr-1">
                <div className="grid gap-4">
                {data.daily.map((item) => (
                  <div key={item.date} className="grid gap-3 rounded-lg border border-line bg-slate-50 p-4 md:grid-cols-[80px_minmax(0,1fr)_160px] md:items-center">
                    <p className="text-sm font-semibold text-slate-600">{formatDate(item.date)}</p>
                    <div className="grid gap-2">
                      <Bar label="访问" value={item.pageViews} max={maxDailyPageViews} tone="blue" />
                      <Bar label="点击" value={item.purchaseClicks} max={maxDailyPurchaseClicks} tone="emerald" />
                      <Bar label="收入" value={item.revenueCents} max={maxDailyRevenue} tone="violet" money />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-slate-600">
                      <span>注册 {item.registrations}</span>
                      <span>点击 {item.purchaseClicks}</span>
                      <span>付费 {item.paidOrders}</span>
                      <span>生成 {item.succeededTasks}</span>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </Card>

            <div className="grid gap-6">
              <Card className="p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-studio-600">工具使用</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">图片任务类型分布</h2>
                </div>
                {data.taskTypes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-muted">
                    暂无图片任务数据。
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {data.taskTypes.map((item) => (
                      <div key={item.type} className="rounded-lg border border-line bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-ink">{item.label}</p>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-studio-700 ring-1 ring-line">
                            {item.total} 次
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted">成功 {item.succeeded} 次 · 成功率 {percent(item.succeeded, item.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-studio-600">用户来源</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">了解到 ImageGood 的渠道</h2>
                </div>
                {data.acquisitionChannels.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-muted">
                    暂无渠道反馈。用户支付成功后可选择来源渠道。
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {data.acquisitionChannels.map((item, index) => (
                      <div key={item.channel} className="rounded-lg border border-line bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-bold text-ink">
                            {index + 1}. {item.channel}
                          </p>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-studio-700 ring-1 ring-line">
                            {item.count} 人
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-studio-600">热门页面</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">功能访问排行</h2>
                </div>
                {data.topPages.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-muted">
                    暂无访问数据。页面打开后会自动开始记录。
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {data.topPages.map((page, index) => (
                      <div key={page.path} className="rounded-lg border border-line bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-bold text-ink">
                            {index + 1}. {page.label}
                          </p>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-studio-700 ring-1 ring-line">
                            {page.views} 次
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted">访问设备/浏览器 {page.uniqueVisitors} 个</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-studio-600">最近付费</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">已完成订单</h2>
                </div>
                {data.recentPaidOrders.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-muted">
                    暂无已支付订单。
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {data.recentPaidOrders.map((order) => (
                      <div key={order.id} className="rounded-lg border border-line bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-ink">{order.packageName}</p>
                          <span className="text-sm font-bold text-emerald-600">{formatCny(order.amountCents)}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted">{order.userEmail}</p>
                        <p className="mt-1 text-xs text-muted">
                          {order.credits} 积分 · {new Date(order.paidAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-button-gradient text-white">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <h2 className="mt-2 text-3xl font-bold text-ink">{value}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{helper}</p>
    </Card>
  );
}

function Bar({
  label,
  value,
  max,
  tone,
  money
}: {
  label: string;
  value: number;
  max: number;
  tone: "blue" | "violet" | "emerald";
  money?: boolean;
}) {
  const width = Math.max(4, Math.round((value / max) * 100));
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_72px] items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div
          className={
            tone === "blue"
              ? "h-full rounded-full bg-studio-500"
              : tone === "emerald"
                ? "h-full rounded-full bg-emerald-500"
                : "h-full rounded-full bg-violet-500"
          }
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-right text-xs font-semibold text-slate-600">
        {money ? formatCny(value) : formatNumber(value)}
      </span>
    </div>
  );
}
