"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiClient, getImageErrorMessage, isEmailNotVerifiedError, isUnauthorizedError } from "@/lib/api-client";
import { trackClientEvent } from "@/lib/client-analytics";
import type { CreditPackage, CreditPackageId } from "@/types/billing";

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
        credits: selectedPackage?.credits ?? null
      }
    });

    setLoadingPackage(packageId);
    setError("");

    try {
      const response = await apiClient.createPaymentOrder({ packageId });
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
          新用户注册赠送 1 次免费生成，积分用完后可按需购买。每次生成消耗 1 积分。
        </p>
      </div>

      {error ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {error.includes("邮箱验证") ? (
            <Link href="/account" className="text-studio-700 underline">
              前往账户中心
            </Link>
          ) : null}
        </div>
      ) : null}

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
          <Card key={item.id} className="flex flex-col p-6 hover:-translate-y-1 hover:border-studio-200 hover:shadow-soft">
            <h2 className="text-xl font-bold text-ink">{item.name}</h2>
            <p className="mt-2 text-sm text-muted">{item.subtitle}</p>
            <div className="mt-6">
              <span className="text-4xl font-bold text-ink">¥{formatPackagePrice(item.priceCents)}</span>
              <span className="ml-2 text-sm font-semibold text-muted">/ {item.credits} 次</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-studio-600">
              约 ¥{(item.priceCents / 100 / item.credits).toFixed(2)} / 次
            </p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {item.credits} 个生成积分
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                微信支付成功后自动到账
              </p>
            </div>
            <Button className="mt-6 w-full" loading={loadingPackage === item.id} onClick={() => handleBuy(item.id)}>
              购买积分
            </Button>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
