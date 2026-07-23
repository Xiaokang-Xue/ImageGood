"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, CreditCard, RefreshCcw, XCircle } from "lucide-react";
import { QrCode } from "@/components/payment/QrCode";
import { PaymentSourceSurvey } from "@/components/payment/PaymentSourceSurvey";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageApiClientError, apiClient, getImageErrorMessage, isUnauthorizedError } from "@/lib/api-client";
import type { PaymentOrderResponse } from "@/types/billing";

const statusLabels: Record<PaymentOrderResponse["status"], string> = {
  pending: "等待支付",
  paid: "支付成功",
  cancelled: "订单已取消",
  expired: "订单已过期",
  failed: "支付失败"
};

function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

export default function CheckoutPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<PaymentOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mockPaying, setMockPaying] = useState(false);
  const [error, setError] = useState("");
  const paidEventSent = useRef(false);

  const loadOrder = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const response = await apiClient.getPaymentOrder(params.orderId);
        setOrder(response);

        if (response.status === "paid" && !paidEventSent.current) {
          paidEventSent.current = true;
          window.dispatchEvent(new Event("ai-image-credits-updated"));
        }
      } catch (requestError) {
        if (isUnauthorizedError(requestError)) {
          router.push(`/login?redirect=${encodeURIComponent(`/checkout/${params.orderId}`)}`);
          return;
        }

        if (requestError instanceof ImageApiClientError && requestError.code === "ORDER_NOT_FOUND") {
          setError("订单不存在或已被删除");
          return;
        }

        if (requestError instanceof ImageApiClientError && requestError.code === "FORBIDDEN") {
          setError("无权限访问该订单");
          return;
        }

        setError(getImageErrorMessage(requestError) || "服务暂时不可用，请稍后重试");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [params.orderId, router]
  );

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order || order.status !== "pending") return undefined;

    const timer = window.setInterval(() => {
      loadOrder(true);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [loadOrder, order]);

  const handleMockPaid = async () => {
    setMockPaying(true);
    setError("");

    try {
      await apiClient.markMockPaymentPaid(params.orderId);
      await loadOrder(true);
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setMockPaying(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1000px] px-5 py-10">
        <Card className="p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-studio-100 border-t-studio-500" />
          <p className="mt-4 text-sm font-semibold text-muted">订单信息加载中…</p>
        </Card>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-[1000px] px-5 py-10">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-ink">{error || "服务暂时不可用，请稍后重试"}</h1>
          <p className="mt-3 text-sm text-muted">你可以返回积分页面重新选择套餐。</p>
          <Link href="/pricing" className="mt-6 inline-flex">
            <Button>返回积分页面</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const isPaid = order.status === "paid";
  const isPending = order.status === "pending";
  const isClosed = order.status === "failed" || order.status === "expired" || order.status === "cancelled";
  const isAlipay = order.paymentProvider === "alipay";

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-10">
      <div className="mb-6">
        <p className="text-sm font-semibold text-studio-600">{isAlipay ? "支付宝支付" : "微信支付"}</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">{isAlipay ? "购买积分" : "扫码购买积分"}</h1>
        <p className="mt-3 text-sm text-muted">支付成功后，积分会自动到账。</p>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink">订单信息</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info label="套餐" value={order.packageName} />
            <Info label="支付金额" value={formatCny(order.amountCents)} />
            <Info label="购买积分" value={`${order.credits} 积分`} />
            <Info label="订单状态" value={statusLabels[order.status]} />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-slate-50 p-4">
            {isPaid ? (
              <div className="flex items-start gap-3 text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-bold">支付成功，积分已到账</p>
                  <p className="mt-1 text-sm">当前剩余积分：{order.currentCredits}</p>
                </div>
              </div>
            ) : isPending ? (
              <div className="flex items-start gap-3 text-studio-800">
                <Clock3 className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-bold">等待{isAlipay ? "支付宝" : "微信"}支付完成，请勿关闭页面</p>
                  <p className="mt-1 text-sm">页面会自动刷新支付状态。</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-rose-700">
                <XCircle className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-bold">{order.status === "expired" ? "订单已过期，请重新购买" : "支付未完成"}</p>
                  <p className="mt-1 text-sm">你可以返回积分页面重新创建订单。</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
          {isPaid ? (
            <Link href="/editor">
              <Button>继续生成图片</Button>
            </Link>
          ) : null}
            {isClosed ? (
              <Link href="/pricing">
                <Button>重新购买</Button>
              </Link>
            ) : null}
            <Button type="button" variant="outline" onClick={() => loadOrder(true)}>
              <RefreshCcw className="h-4 w-4" />
              刷新状态
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink">{isAlipay ? "支付宝收银台" : "微信支付二维码"}</h2>
          {!isAlipay && order.codeUrl && isPending ? (
            <div className="mt-5 rounded-lg border border-line bg-white p-4">
              <QrCode value={order.codeUrl} className="aspect-square w-full" />
            </div>
          ) : isAlipay && order.paymentUrl && isPending ? (
            <div className="mt-5 flex aspect-square items-center justify-center rounded-lg border border-sky-200 bg-sky-50 p-6 text-center">
              <div>
                <CreditCard className="mx-auto h-12 w-12 text-sky-600" />
                <p className="mt-4 text-sm font-bold text-sky-800">请前往支付宝收银台完成支付</p>
                <a href={order.paymentUrl} className="mt-5 inline-flex">
                  <Button>打开支付宝支付</Button>
                </a>
              </div>
            </div>
          ) : isPaid ? (
            <div className="mt-5 flex aspect-square items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
              <div>
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <p className="mt-4 text-sm font-bold text-emerald-700">积分已到账</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex aspect-square items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-sm font-semibold text-rose-700">
              {isAlipay ? "支付宝支付链接生成失败" : "支付二维码生成失败"}
            </div>
          )}
          <p className="mt-4 text-sm leading-6 text-muted">
            {isAlipay
              ? "请在支付宝收银台完成支付。页面跳转不作为到账依据，积分会在支付宝异步通知验签成功后自动到账。"
              : "请使用微信扫码支付。支付完成后，系统会通过微信支付回调自动为账户增加积分。"}
          </p>

          {order.paymentMode === "mock" && isPending ? (
            <Button className="mt-5 w-full" variant="outline" loading={mockPaying} onClick={handleMockPaid}>
              模拟支付成功
            </Button>
          ) : null}
        </Card>
      </div>

      {isPaid ? (
        <div className="mt-6">
          <PaymentSourceSurvey
            orderId={order.orderId}
            packageName={order.packageName}
            amountCents={order.amountCents}
              paymentProvider={order.paymentProvider}
              initialSubmitted={Boolean(order.sourceSurveySubmitted)}
            />
        </div>
      ) : null}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}
