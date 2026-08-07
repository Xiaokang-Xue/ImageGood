"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, CreditCard, Images, QrCode, ShieldCheck, Sparkles, X } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BILLING_PLANS } from "@/config/billing-plans";
import { apiClient, getImageErrorMessage, isUnauthorizedError } from "@/lib/api-client";
import { trackClientEvent } from "@/lib/client-analytics";
import { cn } from "@/lib/utils";
import type { CreditPackage, CreditPackageId, PaymentProvider } from "@/types/billing";

function formatPrice(priceCents: number) {
  const amount = priceCents / 100;
  return amount.toFixed(priceCents % 100 === 0 ? 0 : 1);
}

function formatUnitPrice(plan: CreditPackage) {
  const unitPrice = plan.priceCents / 100 / plan.credits;
  if (plan.credits === 1) return `¥${unitPrice.toFixed(0)} / 张`;
  if (unitPrice >= 0.995) return `约 ¥${Math.round(unitPrice)} / 张`;
  return `约 ¥${unitPrice.toFixed(2)} / 张`;
}

export default function PricingPage() {
  const router = useRouter();
  const [loadingPackage, setLoadingPackage] = useState<CreditPackageId | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<CreditPackage | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [purchaseNotice, setPurchaseNotice] = useState("");

  useEffect(() => {
    const notice = window.sessionStorage.getItem("imagegood:pricing-notice") || "";
    window.sessionStorage.removeItem("imagegood:pricing-notice");
    setPurchaseNotice(notice);
  }, []);

  useEffect(() => {
    if (!paymentPlan) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setPaymentPlan(null);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [paymentPlan]);

  const openPaymentSelector = (plan: CreditPackage) => {
    trackClientEvent({
      type: "purchase_click",
      path: "/pricing",
      target: plan.id,
      metadata: { packageId: plan.id, packageName: plan.name, packageKind: plan.kind, priceCents: plan.priceCents }
    });
    setPaymentError("");
    setPaymentPlan(plan);
  };

  const handleBuy = async (provider: Exclude<PaymentProvider, "manual">) => {
    if (!paymentPlan) return;
    setLoadingPackage(paymentPlan.id);
    setPaymentError("");
    try {
      const response = await apiClient.createPaymentOrder({
        packageId: paymentPlan.id,
        provider
      });
      if (response.paymentProvider === "alipay" && response.paymentUrl) {
        window.location.href = response.paymentUrl;
        return;
      }
      router.push(`/checkout/${response.orderId}`);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        router.push("/login?redirect=/pricing");
        return;
      }
      setPaymentError(getImageErrorMessage(error));
    } finally {
      setLoadingPackage(null);
    }
  };

  return (
    <PageShell>
      <main className="mx-auto max-w-6xl pb-12">
        <header className="mx-auto max-w-2xl pb-8 pt-3 text-center md:pb-10 md:pt-6">
          <p className="text-sm font-semibold text-neutral-500">按创作量灵活选择</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-950 md:text-5xl">选择适合你的创作方案</h1>
          <p className="mt-4 text-sm leading-6 text-neutral-600 md:text-base">
            购买数量越多，折算单价越低。
          </p>
        </header>

        {purchaseNotice ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{purchaseNotice}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {BILLING_PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              loading={loadingPackage === plan.id}
              onBuy={() => openPaymentSelector(plan)}
            />
          ))}
        </div>

        <section className="mt-7 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-neutral-300 bg-neutral-50 p-4 text-xs text-neutral-700 sm:text-sm lg:grid-cols-4">
          <TrustItem text="生成失败不消耗额度" />
          <TrustItem text="支付成功自动到账" />
          <TrustItem text="微信、支付宝均支持" />
          <TrustItem text="额度全站工具通用" />
        </section>
      </main>

      {paymentPlan ? (
        <PaymentSelector
          plan={paymentPlan}
          loading={loadingPackage === paymentPlan.id}
          error={paymentError}
          onClose={() => !loadingPackage && setPaymentPlan(null)}
          onSelect={(provider) => void handleBuy(provider)}
        />
      ) : null}
    </PageShell>
  );
}

function PlanCard({
  plan,
  loading,
  onBuy
}: {
  plan: CreditPackage;
  loading: boolean;
  onBuy: () => void;
}) {
  return (
    <Card
      className={cn(
        "relative flex min-h-[300px] flex-col overflow-hidden border-neutral-300 p-3.5 sm:min-h-[354px] sm:p-5 lg:p-6",
        plan.recommended && "border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-900 sm:h-10 sm:w-10 sm:rounded-xl">
          <Images className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
        {plan.badgeLabel ? (
          <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold sm:px-2.5 sm:text-[11px]", plan.recommended ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700")}>
            {plan.badgeLabel}
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 text-[15px] font-bold leading-5 text-neutral-950 sm:mt-5 sm:text-xl">{plan.name}</h2>
      <p className="mt-1 text-xs text-neutral-500 sm:text-sm">{plan.subtitle}</p>
      <p className="mt-3 text-[28px] font-bold leading-none text-neutral-950 sm:mt-5 sm:text-4xl">¥{formatPrice(plan.priceCents)}</p>
      <p className="mt-2 text-xs font-semibold text-neutral-700 sm:text-sm">{plan.credits} 张图片额度</p>
      <div className="mt-3 rounded-lg bg-neutral-950 px-2.5 py-2 text-white sm:mt-4 sm:px-3 sm:py-2.5">
        <p className="text-[10px] text-neutral-300 sm:text-xs">折算单价</p>
        <p className="mt-0.5 text-sm font-bold tracking-normal sm:text-base">{formatUnitPrice(plan)}</p>
      </div>
      <p className="mt-3 hidden min-h-[44px] text-sm leading-5 text-neutral-600 sm:block">{plan.description}</p>
      <div className="mt-auto pt-4 sm:pt-5">
        <Button className="h-11 w-full px-2 text-sm sm:px-4" variant={plan.recommended ? "dark" : "primary"} loading={loading} onClick={onBuy}>
          {plan.buttonLabel}
        </Button>
      </div>
    </Card>
  );
}

function PaymentSelector({ plan, loading, error, onClose, onSelect }: {
  plan: CreditPackage;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSelect: (provider: Exclude<PaymentProvider, "manual">) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true">
      <div className="w-full rounded-t-2xl border border-neutral-300 bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-neutral-500">确认创作方案</p>
            <h2 className="mt-1 text-xl font-bold text-neutral-950">{plan.name}</h2>
          </div>
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100" aria-label="关闭" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-neutral-700">{plan.credits} 张图片额度</p>
            <p className="mt-1 text-xs font-bold text-neutral-950">{formatUnitPrice(plan)}</p>
          </div>
          <p className="text-2xl font-bold text-neutral-950">¥{formatPrice(plan.priceCents)}</p>
        </div>
        <div className="mt-5 grid gap-3">
          <PaymentOption title="支付宝支付" description="跳转支付宝安全付款" icon={<CreditCard className="h-5 w-5" />} loading={loading} onClick={() => onSelect("alipay")} />
          <PaymentOption title="微信支付" description="生成二维码后使用微信扫码" icon={<QrCode className="h-5 w-5" />} loading={loading} onClick={() => onSelect("wechat")} />
        </div>
        {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />支付成功后权益自动生效
        </p>
      </div>
    </div>
  );
}

function PaymentOption({ title, description, icon, loading, onClick }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="flex min-h-[64px] items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3 text-left transition hover:border-neutral-950 hover:bg-neutral-50 disabled:opacity-60" disabled={loading} onClick={onClick}>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-950 text-white">{icon}</span>
      <span><span className="block text-sm font-bold text-neutral-950">{title}</span><span className="mt-0.5 block text-xs text-neutral-500">{loading ? "正在创建订单…" : description}</span></span>
    </button>
  );
}

function TrustItem({ text }: { text: string }) {
  return <p className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{text}</p>;
}
