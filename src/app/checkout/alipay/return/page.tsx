"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, RefreshCcw, XCircle } from "lucide-react";
import { PaymentSourceSurvey } from "@/components/payment/PaymentSourceSurvey";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";
import type { PaymentOrderResponse } from "@/types/billing";

export default function AlipayReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[820px] px-5 py-10">
          <Card className="p-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-studio-100 border-t-studio-500" />
            <p className="mt-4 text-sm font-semibold text-muted">支付结果加载中…</p>
          </Card>
        </main>
      }
    >
      <AlipayReturnContent />
    </Suspense>
  );
}

function AlipayReturnContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const outTradeNo = searchParams.get("out_trade_no") || "";
  const [order, setOrder] = useState<PaymentOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mockPaying, setMockPaying] = useState(false);
  const [error, setError] = useState("");
  const paidEventSent = useRef(false);

  const loadOrder = useCallback(
    async (silent = false) => {
      if (!orderId && !outTradeNo) {
        setError("无法识别订单，请返回积分页面重新购买");
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError("");

      try {
        const response = orderId
          ? await apiClient.getPaymentOrder(orderId)
          : await apiClient.getPaymentOrderByOutTradeNo(outTradeNo);
        setOrder(response);

        if (response.status === "paid" && !paidEventSent.current) {
          paidEventSent.current = true;
          window.dispatchEvent(new Event("ai-image-credits-updated"));
        }
      } catch (requestError) {
        setError(getImageErrorMessage(requestError) || "订单状态暂时无法确认，请稍后刷新");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId, outTradeNo]
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
    if (!order) return;
    setMockPaying(true);
    setError("");

    try {
      await apiClient.markMockPaymentPaid(order.orderId);
      await loadOrder(true);
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setMockPaying(false);
    }
  };

  const isPaid = order?.status === "paid";
  const isPending = order?.status === "pending";
  const isClosed = order?.status === "failed" || order?.status === "expired" || order?.status === "cancelled";

  return (
    <main className="mx-auto max-w-[820px] px-5 py-10">
      <Card className="p-8">
        <p className="text-sm font-semibold text-studio-600">支付宝支付</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">
          {isPaid ? "支付成功，积分已到账" : isClosed ? "支付未完成" : "支付结果确认中"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          return_url 只用于页面跳转，系统会继续等待支付宝异步通知完成验签。请稍候，页面会自动刷新订单状态。
        </p>

        {loading ? (
          <div className="mt-8 rounded-xl border border-line bg-slate-50 p-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-studio-100 border-t-studio-500" />
            <p className="mt-4 text-sm font-semibold text-muted">订单信息加载中…</p>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : order ? (
          <div className="mt-8 rounded-xl border border-line bg-slate-50 p-5">
            {isPaid ? (
              <div className="flex items-start gap-3 text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-6 w-6" />
                <div>
                  <p className="text-base font-bold">支付成功，积分已到账</p>
                  <p className="mt-1 text-sm">当前剩余积分：{order.currentCredits}</p>
                </div>
              </div>
            ) : isPending ? (
              <div className="flex items-start gap-3 text-studio-800">
                <Clock3 className="mt-0.5 h-6 w-6" />
                <div>
                  <p className="text-base font-bold">等待支付宝异步通知确认</p>
                  <p className="mt-1 text-sm">如果你已经完成付款，通常稍等片刻即可到账。</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-rose-700">
                <XCircle className="mt-0.5 h-6 w-6" />
                <div>
                  <p className="text-base font-bold">{order.status === "expired" ? "订单已过期" : "支付未完成"}</p>
                  <p className="mt-1 text-sm">你可以返回积分页面重新创建订单。</p>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-3 text-sm text-muted sm:grid-cols-2">
              <Info label="套餐" value={order.packageName} />
              <Info label="支付金额" value={`¥${(order.amountCents / 100).toFixed(2)}`} />
              <Info label="积分" value={`${order.credits} 积分`} />
              <Info label="商户订单号" value={order.outTradeNo} />
            </div>
          </div>
        ) : null}

        {isPaid && order ? (
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
          {order?.paymentMode === "mock" && isPending ? (
            <Button variant="outline" loading={mockPaying} onClick={handleMockPaid}>
              模拟支付成功
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => loadOrder(true)}>
            <RefreshCcw className="h-4 w-4" />
            刷新状态
          </Button>
        </div>
      </Card>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 break-all text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
