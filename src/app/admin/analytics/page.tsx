"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  CreditCard,
  Eye,
  Image as ImageIcon,
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
import type { AdminAnalyticsResponse, AnalyticsFunnelRange, AnalyticsFunnelStep } from "@/types/analytics";

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  });
}

function formatBeijingDateTime(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(new Date(date));
}

function percent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [funnelRange, setFunnelRange] = useState<AnalyticsFunnelRange>("all");

  const loadData = useCallback((refresh = false) => {
    setLoading(true);
    setError("");

    apiClient
      .getAdminAnalytics({ range: funnelRange, refresh })
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
  }, [funnelRange]);

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
          <p className="mt-3 text-sm text-muted">按北京时间查看今日表现、累计规模和用户转化流失。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/orders">
            <Button variant="outline">查看订单后台</Button>
          </Link>
          <Button variant="dark" loading={loading} onClick={() => loadData(true)}>
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
          <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2 font-semibold text-neutral-800">
              <Clock3 className="h-4 w-4" />
              统计日期 {data.meta.today}，时区为北京时间（UTC+8）
            </span>
            <span>数据更新于 {formatBeijingDateTime(data.meta.generatedAt)}</span>
          </div>

          <SectionHeading eyebrow="今日数据" title="今天的实际运营表现" description="所有今日指标均按北京时间 00:00 至当前时刻统计。" />
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={Eye}
              label="今日访问人数"
              value={`${formatNumber(data.overview.todayVisitors)} 人`}
              helper={`按设备或浏览器去重 · 页面访问 ${formatNumber(data.overview.todayPageViews)} 次`}
            />
            <MetricCard
              icon={UserPlus}
              label="今日新注册"
              value={`${formatNumber(data.overview.todayRegistrations)} 人`}
              helper={`今日访问过网站的登录用户 ${formatNumber(data.overview.todayActiveUsers)} 人`}
            />
            <MetricCard
              icon={ImageIcon}
              label="今日图片任务"
              value={`${formatNumber(data.overview.todayTasks)} 次`}
              helper={`成功 ${formatNumber(data.overview.todaySucceededTasks)} 次 · 使用用户 ${formatNumber(data.overview.todayTaskUsers)} 人`}
            />
            <MetricCard
              icon={CreditCard}
              label="今日支付收入"
              value={formatCny(data.overview.todayRevenueCents)}
              helper={`支付成功 ${formatNumber(data.overview.todayPaidOrders)} 单`}
            />
            <MetricCard
              icon={ShoppingCart}
              label="今日创建订单"
              value={`${formatNumber(data.overview.todayCreatedOrders)} 单`}
              helper={`其中当前待付款 ${formatNumber(data.overview.todayPendingOrders)} 单`}
            />
          </section>

          <SectionHeading
            eyebrow="累计数据"
            title="业务规模与长期质量"
            description="累计指标使用数据库中的全部历史记录，不与今日口径混合。"
            className="mt-8"
          />
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={Eye}
              label="累计访问量"
              value={`${formatNumber(data.overview.totalPageViews)} 次`}
              helper={`累计访问人数 ${formatNumber(data.overview.uniqueVisitors)} 人（按设备或浏览器去重）`}
            />
            <MetricCard
              icon={Users}
              label="累计已注册用户"
              value={`${formatNumber(data.overview.totalUsers)} 人`}
              helper={`已验证联系方式 ${formatNumber(data.overview.verifiedUsers)} 人 · 验证率 ${percent(data.overview.verifiedUsers, data.overview.totalUsers)}`}
            />
            <MetricCard
              icon={ImageIcon}
              label="累计图片任务"
              value={`${formatNumber(data.overview.totalTasks)} 次`}
              helper={`成功 ${formatNumber(data.overview.succeededTasks)} 次 · 成功率 ${percent(data.overview.succeededTasks, data.overview.totalTasks)}`}
            />
            <MetricCard
              icon={CreditCard}
              label="累计支付收入"
              value={formatCny(data.overview.revenueCents)}
              helper={`付费用户 ${formatNumber(data.overview.payingUsers)} 人 · 已完成订单 ${formatNumber(data.overview.paidOrders)} 单`}
            />
            <MetricCard
              icon={Repeat2}
              label="累计复购率"
              value={`${(data.overview.repeatPurchaseRate * 100).toFixed(1)}%`}
              helper={`复购用户 ${formatNumber(data.overview.repeatPurchaseUsers)} 人 · 当前待付款 ${formatNumber(data.overview.pendingOrders)} 单`}
            />
          </section>

          <section className="mt-8">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-studio-600">完整转化漏斗</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">从访问到复购的用户流失</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  每一步按用户或访问者去重，并要求后一步发生在前一步之后。默认展示全部历史数据，也可切换观察近期转化。
                </p>
              </div>
              <div className="inline-flex w-fit rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                {([
                  ["today", "今日"],
                  ["7d", "近 7 天"],
                  ["30d", "近 30 天"],
                  ["all", "全部"]
                ] as Array<[AnalyticsFunnelRange, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      funnelRange === value ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-600 hover:bg-white hover:text-neutral-950"
                    }`}
                    onClick={() => setFunnelRange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.8fr_0.65fr]">
              <FunnelGroup
                title="访问激活"
                description="从首页继续进入任一图片工具"
                steps={data.funnel.steps.filter((step) => step.group === "activation")}
              />
              <FunnelGroup
                title="购买转化"
                description="从了解价格到支付成功"
                steps={data.funnel.steps.filter((step) => step.group === "payment")}
              />
              <FunnelGroup
                title="付费留存"
                description="首次购买后的复购表现"
                steps={data.funnel.steps.filter((step) => step.group === "retention")}
              />
            </div>
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
                {[...data.daily].reverse().map((item) => (
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

function SectionHeading({
  eyebrow,
  title,
  description,
  className = ""
}: {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <p className="text-sm font-semibold text-studio-600">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function FunnelGroup({
  title,
  description,
  steps
}: {
  title: string;
  description: string;
  steps: AnalyticsFunnelStep[];
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 border-b border-line pb-4">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="grid gap-3">
        {steps.map((step) => (
          <div key={step.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-center gap-2">
              <div>
                <p className="text-xs font-semibold text-neutral-500">{step.fromLabel}</p>
                <p className="mt-1 text-xl font-bold text-neutral-950">{formatNumber(step.fromUsers)} 人</p>
              </div>
              <ArrowRight className="h-4 w-4 text-neutral-400" />
              <div className="text-right">
                <p className="text-xs font-semibold text-neutral-500">{step.toLabel}</p>
                <p className="mt-1 text-xl font-bold text-neutral-950">{formatNumber(step.toUsers)} 人</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  step.fromUsers === 0
                    ? "bg-neutral-200 text-neutral-600"
                    : step.conversionRate >= 0.6
                      ? "bg-emerald-100 text-emerald-700"
                      : step.conversionRate >= 0.3
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                }`}
              >
                转化率 {step.fromUsers === 0 ? "暂无数据" : `${(step.conversionRate * 100).toFixed(1)}%`}
              </span>
              <span className="text-xs font-semibold text-neutral-500">
                流失 {formatNumber(step.dropOffUsers)} 人
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-neutral-900"
                style={{ width: `${step.fromUsers > 0 ? Math.max(2, step.conversionRate * 100) : 0}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-500">{step.description}</p>
          </div>
        ))}
      </div>
    </Card>
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
