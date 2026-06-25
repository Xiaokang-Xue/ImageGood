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
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold text-studio-600">购买积分</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">选择适合你的积分包</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
          新用户注册赠送 1 次免费生成，积分用完后可按需购买。购买更多积分，单次生成成本更低。
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

      <Card className="mx-auto mb-8 max-w-2xl p-4">
        <p className="mb-3 text-sm font-semibold text-ink">选择支付方式</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              paymentProvider === "wechat"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-line bg-white text-slate-700 hover:border-studio-200"
            }`}
            onClick={() => setPaymentProvider("wechat")}
          >
            <QrCode className="h-5 w-5" />
            <span>
              <span className="block text-sm font-bold">微信支付</span>
              <span className="block text-xs text-muted">扫码完成支付</span>
            </span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              paymentProvider === "alipay"
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-line bg-white text-slate-700 hover:border-studio-200"
            }`}
            onClick={() => setPaymentProvider("alipay")}
          >
            <CreditCard className="h-5 w-5" />
            <span>
              <span className="block text-sm font-bold">支付宝支付</span>
              <span className="block text-xs text-muted">跳转支付宝收银台</span>
            </span>
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
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

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {packages.map((item) => (
          <Card
            key={item.id}
            className={`relative flex flex-col p-6 hover:-translate-y-1 hover:border-studio-200 hover:shadow-soft ${
              item.recommended ? "border-studio-300 shadow-soft ring-2 ring-studio-100" : ""
            }`}
          >
            {item.recommended ? (
              <div className="absolute right-4 top-4 rounded-full bg-studio-600 px-3 py-1 text-xs font-bold text-white">
                推荐套餐
              </div>
            ) : null}
            <h2 className="text-xl font-bold text-ink">{item.name}</h2>
            <p className="mt-2 text-sm text-muted">{item.subtitle}</p>
            {item.description ? <p className="mt-3 min-h-[44px] text-sm leading-6 text-slate-600">{item.description}</p> : null}
            <div className="mt-6">
              <span className="text-4xl font-bold text-ink">¥{formatPackagePrice(item.priceCents)}</span>
              <span className="ml-2 text-sm font-semibold text-muted">/ {item.credits} 次</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-studio-600">
              单次约 {item.unitPriceLabel ?? `¥${(item.priceCents / 100 / item.credits).toFixed(2)} / 次`}
            </p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {item.credits} 个生成积分
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                支付成功后自动到账
              </p>
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
            积分支付成功后自动到账，可用于 AI 修图、商品图生成、封面海报生成等功能。
          </p>
          <p className="flex gap-2">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
            购买更多积分，单次生成成本更低。
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
