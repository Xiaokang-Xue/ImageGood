"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
  Zap
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  apiClient,
  getImageErrorMessage,
  isUnauthorizedError
} from "@/lib/api-client";
import { trackClientEvent } from "@/lib/client-analytics";
import { cn } from "@/lib/utils";
import type {
  CreditPackage,
  CreditPackageId,
  CreditPackageKind,
  PaymentProvider
} from "@/types/billing";

function formatPackagePrice(priceCents: number) {
  const amount = priceCents / 100;
  return amount.toFixed(priceCents % 100 === 0 ? 0 : 1);
}

export default function PricingPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState<CreditPackageId | null>(null);
  const [category, setCategory] = useState<CreditPackageKind>("credit_pack");
  const [selectedPackageId, setSelectedPackageId] = useState<CreditPackageId>("standard");
  const [paymentPlan, setPaymentPlan] = useState<CreditPackage | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .listBillingPackages()
      .then((response) => setPackages(response.packages))
      .catch(() => setError("套餐暂时无法加载，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!paymentPlan) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPaymentPlan(null);
        setPaymentError("");
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [paymentPlan]);

  const visiblePackages = useMemo(
    () => packages.filter((item) => item.kind === category),
    [category, packages]
  );
  const selectedPackage =
    visiblePackages.find((item) => item.id === selectedPackageId) ?? visiblePackages[0] ?? null;

  const changeCategory = (nextCategory: CreditPackageKind) => {
    setCategory(nextCategory);
    const nextPlans = packages.filter((item) => item.kind === nextCategory);
    const preferred =
      nextPlans.find((item) => item.recommended) ??
      nextPlans.find((item) => item.id === "standard") ??
      nextPlans[0];
    if (preferred) setSelectedPackageId(preferred.id);
  };

  const openPaymentSelector = (plan: CreditPackage) => {
    trackClientEvent({
      type: "purchase_click",
      path: "/pricing",
      target: plan.id,
      metadata: {
        packageId: plan.id,
        packageName: plan.name,
        packageKind: plan.kind,
        priceCents: plan.priceCents,
        credits: plan.credits
      }
    });
    setPaymentError("");
    setPaymentPlan(plan);
  };

  const handleBuy = async (paymentProvider: Exclude<PaymentProvider, "manual">) => {
    if (!paymentPlan) return;
    setLoadingPackage(paymentPlan.id);
    setPaymentError("");
    try {
      const response = await apiClient.createPaymentOrder({
        packageId: paymentPlan.id,
        provider: paymentProvider
      });
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
      setPaymentError(getImageErrorMessage(requestError));
    } finally {
      setLoadingPackage(null);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl pb-10">
        <header className="pb-6 pt-2 text-center md:pb-9 md:pt-5">
          <p className="text-sm font-semibold text-neutral-500">为下一张好作品充能</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-neutral-950 md:text-5xl">
            选择你的创作节奏
          </h1>
        </header>

        {error ? (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            {error.includes("验证") ? (
              <Link href="/account" className="underline">
                前往账户中心
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="sticky top-16 z-20 -mx-2 mb-5 bg-page/95 px-2 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
          <div className="mx-auto grid max-w-[280px] grid-cols-2 rounded-lg border border-neutral-300 bg-white p-1 shadow-sm">
            <CategoryButton
              active={category === "credit_pack"}
              icon={<Zap className="h-4 w-4" />}
              title="灵活积分"
              onClick={() => changeCategory("credit_pack")}
            />
            <CategoryButton
              active={category === "membership"}
              icon={<CalendarDays className="h-4 w-4" />}
              title="创作会员"
              onClick={() => changeCategory("membership")}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Card key={item} className="h-[330px] animate-pulse p-5" />
            ))}
          </div>
        ) : null}

        {!loading && packages.length === 0 ? (
          <Card className="p-8 text-center">
            <h2 className="text-lg font-bold text-ink">套餐暂时不可用</h2>
            <p className="mt-2 text-sm text-muted">服务暂时不可用，请稍后重试。</p>
          </Card>
        ) : null}

        {!loading && visiblePackages.length > 0 ? (
          <>
            <div className="-mx-1 mb-4 flex snap-x gap-3 overflow-x-auto px-1 pb-2 md:hidden">
              {visiblePackages.map((item) => (
                <MobilePlanOption
                  key={item.id}
                  plan={item}
                  active={selectedPackage?.id === item.id}
                  onClick={() => setSelectedPackageId(item.id)}
                />
              ))}
            </div>

            <div className="md:hidden">
              {selectedPackage ? (
                <PlanCard
                  plan={selectedPackage}
                  loading={loadingPackage === selectedPackage.id}
                  onBuy={() => openPaymentSelector(selectedPackage)}
                />
              ) : null}
            </div>

            <div
              className={cn(
                "hidden gap-4 md:grid",
                category === "membership"
                  ? "mx-auto max-w-3xl md:grid-cols-2"
                  : "md:grid-cols-2 xl:grid-cols-5"
              )}
            >
              {visiblePackages.map((item) => (
                <PlanCard
                  key={item.id}
                  plan={item}
                  compact={category === "credit_pack"}
                  loading={loadingPackage === item.id}
                  onBuy={() => openPaymentSelector(item)}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-6 grid gap-2 rounded-xl border border-neutral-300 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 sm:grid-cols-3 md:text-sm">
          <TrustItem text="生成失败不扣积分" />
          <TrustItem text="微信、支付宝均支持" />
          <TrustItem text="会员不自动续费，到期未使用积分清零" />
        </div>
      </div>

      {paymentPlan ? (
        <PaymentSelector
          plan={paymentPlan}
          loading={loadingPackage === paymentPlan.id}
          error={paymentError}
          onClose={() => {
            if (loadingPackage) return;
            setPaymentPlan(null);
            setPaymentError("");
          }}
          onSelect={(provider) => void handleBuy(provider)}
        />
      ) : null}
    </PageShell>
  );
}

function PlanCard({
  plan,
  compact = false,
  loading,
  onBuy
}: {
  plan: CreditPackage;
  compact?: boolean;
  loading: boolean;
  onBuy: () => void;
}) {
  const isMembership = plan.kind === "membership";
  return (
    <Card
      className={cn(
        "relative flex flex-col border-neutral-300 p-5 transition hover:-translate-y-0.5 hover:border-neutral-500",
        plan.recommended && "border-neutral-950 ring-1 ring-neutral-950",
        !compact && "md:p-6"
      )}
    >
      {plan.recommended ? (
        <span className="absolute right-4 top-4 rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-bold text-white">
          推荐
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border",
            isMembership
              ? "border-violet-200 bg-violet-50 text-violet-700"
              : "border-neutral-200 bg-neutral-50 text-neutral-700"
          )}
        >
          {isMembership ? <Sparkles className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        </span>
        <div>
          <h2 className="text-lg font-bold text-neutral-950">{plan.name}</h2>
          <p className="text-xs text-neutral-500">{plan.subtitle}</p>
        </div>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className="text-3xl font-bold text-neutral-950">
          ¥{formatPackagePrice(plan.priceCents)}
        </span>
        {isMembership ? (
          <span className="pb-1 text-xs font-semibold text-neutral-500">
            / {plan.validityMonths === 12 ? "年" : "月"}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xl font-bold text-neutral-900">
        {plan.creditsLabel ?? `${plan.credits} 积分`}
      </p>
      {plan.description ? (
        <p className="mt-3 min-h-[40px] text-sm leading-5 text-neutral-600">{plan.description}</p>
      ) : null}

      <div className="mt-4 grid gap-2 text-xs text-neutral-600">
        {isMembership ? (
          <>
            <Feature text={plan.validityLabel ?? "限时有效"} />
            <Feature text="购买后一次到账，不自动续费" />
            <Feature text="有效期结束后未使用积分清零" />
          </>
        ) : (
          <>
            <Feature text={`${plan.credits} 个永久积分`} />
            <Feature text="全部图片工具通用" />
            {plan.oneTimeNotice ? <Feature text={plan.oneTimeNotice} /> : null}
          </>
        )}
      </div>

      <Button
        className="mt-5 w-full"
        variant={plan.recommended ? "dark" : "primary"}
        loading={loading}
        onClick={onBuy}
      >
        {plan.buttonLabel ?? "立即购买"}
      </Button>
    </Card>
  );
}

function CategoryButton({
  active,
  icon,
  title,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-center transition",
        active ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="text-xs font-bold sm:text-sm">{title}</span>
    </button>
  );
}

function MobilePlanOption({
  plan,
  active,
  onClick
}: {
  plan: CreditPackage;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative min-h-[94px] w-[154px] shrink-0 snap-start overflow-hidden rounded-xl border p-3 text-left shadow-sm transition",
        active
          ? "border-neutral-950 bg-neutral-950 text-white ring-1 ring-neutral-950"
          : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-500"
      )}
      onClick={onClick}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold">{plan.name}</span>
        {plan.recommended ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              active ? "bg-white text-neutral-950" : "bg-neutral-950 text-white"
            )}
          >
            推荐
          </span>
        ) : plan.badgeLabel ? (
          <span className={cn("text-[10px] font-semibold", active ? "text-neutral-300" : "text-neutral-500")}>
            {plan.badgeLabel}
          </span>
        ) : null}
      </span>
      <span className="mt-3 block text-xl font-bold">¥{formatPackagePrice(plan.priceCents)}</span>
      <span className={cn("mt-1 block text-xs font-semibold", active ? "text-neutral-300" : "text-neutral-500")}>
        {plan.creditsLabel ?? `${plan.credits} 积分`}
      </span>
    </button>
  );
}

function PaymentSelector({
  plan,
  loading,
  error,
  onClose,
  onSelect
}: {
  plan: CreditPackage;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSelect: (provider: Exclude<PaymentProvider, "manual">) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-selector-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full rounded-t-2xl border border-neutral-300 bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200 sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-neutral-500">确认套餐</p>
            <h2 id="payment-selector-title" className="mt-1 text-xl font-bold text-neutral-950">
              {plan.name}
            </h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
            aria-label="关闭支付方式选择"
            disabled={loading}
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {plan.creditsLabel ?? `${plan.credits} 积分`}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {plan.kind === "membership" ? plan.validityLabel : "永久有效"}
            </p>
          </div>
          <p className="text-2xl font-bold text-neutral-950">¥{formatPackagePrice(plan.priceCents)}</p>
        </div>

        <p className="mt-5 text-sm font-bold text-neutral-950">选择支付方式</p>
        <div className="mt-3 grid gap-3">
          <PaymentOption
            title="支付宝支付"
            description="跳转支付宝安全完成付款"
            icon={<CreditCard className="h-5 w-5" />}
            loading={loading}
            onClick={() => onSelect("alipay")}
          />
          <PaymentOption
            title="微信支付"
            description="生成二维码后使用微信扫码"
            icon={<QrCode className="h-5 w-5" />}
            loading={loading}
            onClick={() => onSelect("wechat")}
          />
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          支付成功自动到账，生成失败不扣积分
        </p>
      </div>
    </div>
  );
}

function PaymentOption({
  title,
  description,
  icon,
  loading,
  onClick
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-[64px] items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left transition hover:border-neutral-950 hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
      disabled={loading}
      onClick={onClick}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-neutral-950">{title}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{loading ? "正在创建订单…" : description}</span>
      </span>
      <span className="text-lg text-neutral-400">›</span>
    </button>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
      {text}
    </p>
  );
}

function TrustItem({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      {text}
    </p>
  );
}
