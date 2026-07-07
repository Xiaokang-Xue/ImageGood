"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, QrCode } from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiClient, getImageErrorMessage, isEmailNotVerifiedError, isUnauthorizedError } from "@/lib/api-client";
import { trackClientEvent } from "@/lib/client-analytics";
import type { CreditPackage, CreditPackageId, PaymentProvider } from "@/types/billing";

function formatPackagePrice(priceCents: number) {
  const amount = priceCents / 100;
  if (priceCents < 100) {
    return amount.toFixed(2);
  }
  return amount.toFixed(priceCents % 100 === 0 ? 0 : 1);
}

export default function PricingPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState<CreditPackageId | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<Exclude<PaymentProvider, "manual">>("alipay");
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .listBillingPackages()
      .then((response) => setPackages(response.packages))
      .catch(() => setError("积分套餐暂时无法加载，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (packageId: CreditPackageId) => {
    const selectedPackage = packages.find((item) => item.id === packageId);
    trackClientEvent({
      type: "purchase_click",
      path: "/pricing",
      target: packageId,
      metadata: {
        packageId,
        packageName: selectedPackage?.name ?? packageId,
        priceCents: selectedPackage?.priceCents ?? null,
        credits: selectedPackage?.credits ?? null,
        paymentProvider
      }
    });

    setLoadingPackage(packageId);
    setError("");

    try {
      const response = await apiClient.createPaymentOrder({ packageId, provider: paymentProvider });
      if (response.paymentProvider === "alipay" && response.paymentUrl) {
        window.location.href = response.paymentUrl;
        return;
      }
      router.push(`/checkout/${response.orderId}`);
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.push("/login?redirect=/pricing");
        return;
      }
      if (isEmailNotVerifiedError(requestError)) {
        setError(getImageErrorMessage(requestError));
        return;
      }
      setError(getImageErrorMessage(requestError));
    } finally {
      setLoadingPackage(null);
    }
  };

  return (
    <PageShell>
      <div className="mb-10 pt-4 text-center">
        <p className="text-sm font-semibold text-blue-600">购买积分</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">选择适合你的积分包</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
          积分可用于 ImageGood 全部 AI 图片工具。支付成功自动到账，生成失败不扣积分。
        </p>
      </div>

      {error ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {error.includes("验证") ? (
            <Link href="/account" className="text-studio-700 underline">
              前往账户中心
            </Link>
          ) : null}
        </div>
      ) : null}

      <Card className="mx-auto mb-10 max-w-2xl p-4">
        <p className="mb-3 text-sm font-semibold text-ink">选择支付方式</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
              paymentProvider === "wechat"
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
            }`}
            onClick={() => setPaymentProvider("wechat")}
          >
            <QrCode className="h-5 w-5" />
            <span>
              <span className="block text-sm font-bold">微信支付</span>
              <span className={`block text-xs ${paymentProvider === "wechat" ? "text-neutral-300" : "text-muted"}`}>扫码完成支付</span>
            </span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
              paymentProvider === "alipay"
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
            }`}
            onClick={() => setPaymentProvider("alipay")}
          >
            <CreditCard className="h-5 w-5" />
            <span>
              <span className="block text-sm font-bold">支付宝支付</span>
              <span className={`block text-xs ${paymentProvider === "alipay" ? "text-neutral-300" : "text-muted"}`}>跳转支付宝收银台</span>
            </span>
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <Card key={item} className="h-[300px] animate-pulse p-6" />
          ))}
        </div>
      ) : null}

      {!loading && packages.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-bold text-ink">积分套餐暂时不可用</h2>
          <p className="mt-2 text-sm text-muted">服务暂时不可用，请稍后重试。</p>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {packages.map((item) => (
          <Card
            key={item.id}
            className={`relative flex flex-col p-6 hover:border-neutral-400 ${
              item.recommended ? "border-neutral-950 shadow-[0_10px_30px_rgba(0,0,0,0.08)] ring-1 ring-neutral-950" : ""
            }`}
          >
            {item.recommended ? (
              <div className="absolute right-4 top-4 rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold text-white">
                推荐
              </div>
            ) : null}
            {item.badgeLabel ? (
              <div className="mb-4 inline-flex w-fit rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-bold text-neutral-700">
                {item.badgeLabel}
              </div>
            ) : null}
            <h2 className="text-xl font-bold text-ink">{item.name}</h2>
            {item.subtitle !== item.badgeLabel ? <p className="mt-2 text-sm text-muted">{item.subtitle}</p> : null}
            {item.description ? <p className="mt-3 min-h-[44px] text-sm leading-6 text-slate-600">{item.description}</p> : null}
            <div className="mt-6">
              <span className="text-4xl font-bold text-ink">¥{formatPackagePrice(item.priceCents)}</span>
              <span className="ml-2 text-sm font-semibold text-muted">{item.credits} 积分</span>
            </div>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {item.credits} 个生成积分
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                支付成功后自动到账
              </p>
              {item.oneTimeNotice ? (
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {item.oneTimeNotice}
                </p>
              ) : null}
            </div>
            <Button className="mt-6 w-full" loading={loadingPackage === item.id} onClick={() => handleBuy(item.id)}>
              {item.buttonLabel ?? "购买积分"}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-5">
        <div className="grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
          <p className="flex gap-2">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
            每次生成消耗 1 个积分，生成失败不扣积分。
          </p>
          <p className="flex gap-2">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
            积分可用于 AI 修图、文生图、智能抠图、图片增强、去杂物、商品图和封面海报等功能。
          </p>
          <p className="flex gap-2">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
            微信、支付宝均支持，支付成功后自动到账。
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
