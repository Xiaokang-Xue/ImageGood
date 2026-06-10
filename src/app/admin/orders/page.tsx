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

function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">管理员</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">微信支付订单</h1>
          <p className="mt-3 text-sm text-muted">正常订单由微信支付回调自动加积分。管理员补发仅用于异常处理。</p>
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

      {loading ? (
        <Card className="p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-studio-100 border-t-studio-500" />
          <p className="mt-4 text-sm font-semibold text-muted">订单信息加载中…</p>
        </Card>
      ) : !error && orders.length === 0 ? (
        <Card className="p-8 text-center text-sm font-semibold text-muted">当前没有待处理订单。</Card>
      ) : !error ? (
        <div className="grid gap-4">
          {orders.map((order) => (
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
                    <p>用户邮箱：{order.userEmail}</p>
                    <p>用户昵称：{order.userName || "未填写"}</p>
                    <p>支付渠道：微信支付 / Native 扫码</p>
                    <p>商户订单号：{order.outTradeNo}</p>
                    <p>微信交易号：{order.transactionId || "未返回"}</p>
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
