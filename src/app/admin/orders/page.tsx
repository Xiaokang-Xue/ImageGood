"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageApiClientError, apiClient, getImageErrorMessage, isUnauthorizedError } from "@/lib/api-client";
import type { AdminOrderRecord } from "@/types/billing";

const statusLabels: Record<AdminOrderRecord["status"], string> = {
  pending: "待支付",
  paid: "已完成",
  cancelled: "已取消",
  expired: "已过期",
  failed: "失败"
};

const providerLabels: Record<AdminOrderRecord["paymentProvider"], string> = {
  wechat: "微信支付",
  alipay: "支付宝支付",
  manual: "手动订单"
};

const methodLabels: Record<AdminOrderRecord["paymentMethod"], string> = {
  native: "Native 扫码",
  page: "电脑网站支付",
  manual: "人工处理"
};

function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

const PAGE_SIZE = 10;

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<"all" | AdminOrderRecord["paymentProvider"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminOrderRecord["status"]>("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const loadOrders = useCallback(() => {
    setLoading(true);
    setError("");

    apiClient
      .listAdminOrders()
      .then((response) => setOrders(response.orders))
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
    loadOrders();
  }, [loadOrders]);

  const handleConfirm = async (orderId: string) => {
    const confirmed = window.confirm("该操作仅用于异常补发积分。确认后会将订单标记为已完成并给用户增加积分，是否继续？");
    if (!confirmed) return;

    setConfirmingId(orderId);
    setError("");

    try {
      await apiClient.confirmAdminOrder(orderId);
      await apiClient
        .listAdminOrders()
        .then((response) => setOrders(response.orders));
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setConfirmingId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesProvider = providerFilter === "all" || order.paymentProvider === providerFilter;
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesProvider && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedOrders = filteredOrders.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [providerFilter, statusFilter]);

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">管理员</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">支付订单</h1>
          <p className="mt-3 text-sm text-muted">正常订单由支付平台异步通知自动加积分。管理员补发仅用于异常处理。</p>
        </div>
        <Link href="/admin/analytics">
          <Button variant="outline">查看运营数据</Button>
        </Link>
      </div>

      {error ? (
        <Card className="mb-5 border-rose-200 bg-rose-50 p-5">
          <h2 className="text-lg font-bold text-rose-700">{error}</h2>
          <p className="mt-2 text-sm text-rose-600">
            {error === "无权限访问" ? "当前账号不是管理员，无法访问订单确认后台。" : "请检查登录状态或稍后重试。"}
          </p>
        </Card>
      ) : null}

      {!loading && !error ? (
        <div className="mb-5 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold text-muted">支付方式</span>
            {[
              ["all", "全部"],
              ["wechat", "微信支付"],
              ["alipay", "支付宝支付"],
              ["manual", "手动订单"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  providerFilter === value ? "border-studio-300 bg-studio-50 text-studio-700" : "border-line bg-white text-muted"
                }`}
                onClick={() => setProviderFilter(value as typeof providerFilter)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold text-muted">订单状态</span>
            {[
              ["all", "全部"],
              ["pending", "待支付"],
              ["paid", "已完成"],
              ["failed", "失败"],
              ["expired", "已过期"],
              ["cancelled", "已取消"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  statusFilter === value ? "border-studio-300 bg-studio-50 text-studio-700" : "border-line bg-white text-muted"
                }`}
                onClick={() => setStatusFilter(value as typeof statusFilter)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">
            <span>
              共 {filteredOrders.length} 条订单
              {filteredOrders.length > 0 ? `，当前显示第 ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filteredOrders.length)} 条` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                上一页
              </Button>
              <span className="text-sm font-semibold text-slate-600">
                {safePage} / {totalPages}
              </span>
              <Button type="button" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                下一页
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <Card className="p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-studio-100 border-t-studio-500" />
          <p className="mt-4 text-sm font-semibold text-muted">订单信息加载中…</p>
        </Card>
      ) : !error && filteredOrders.length === 0 ? (
        <Card className="p-8 text-center text-sm font-semibold text-muted">当前没有符合条件的订单。</Card>
      ) : !error ? (
        <div className="grid gap-4">
          {pagedOrders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-studio-600">{order.packageName}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-ink">{formatCny(order.amountCents)} / {order.credits} 积分</h2>
                  <div className="mt-3 grid gap-1 text-sm text-muted">
                    <p>订单 ID：{order.id}</p>
                    <p>用户账号：{order.userEmail}</p>
                    <p>用户昵称：{order.userName || "未填写"}</p>
                    <p>支付渠道：{providerLabels[order.paymentProvider]} / {methodLabels[order.paymentMethod]}</p>
                    <p>商户订单号：{order.outTradeNo}</p>
                    <p>平台交易号：{order.transactionId || "未返回"}</p>
                    <p>创建时间：{new Date(order.createdAt).toLocaleString("zh-CN")}</p>
                    <p>支付时间：{order.paidAt ? new Date(order.paidAt).toLocaleString("zh-CN") : "未支付"}</p>
                  </div>
                </div>
                <Button
                  loading={confirmingId === order.id}
                  disabled={order.status === "paid"}
                  variant="outline"
                  onClick={() => handleConfirm(order.id)}
                >
                  异常补发积分
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </main>
  );
}
