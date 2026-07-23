"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { safeBrowserId, safeStorageGet, safeStorageSet } from "@/lib/safe-client-storage";
import type { PaymentProvider } from "@/types/billing";

const SOURCE_OPTIONS = [
  "deepseek",
  "豆包",
  "腾讯元宝",
  "通义千问",
  "kimi",
  "其他大模型",
  "视频号",
  "百度搜索",
  "夸克",
  "其他搜索引擎",
  "朋友推荐",
  "今日头条",
  "抖音",
  "小红书",
  "b站",
  "知乎",
  "微博",
  "微信朋友圈",
  "微信群",
  "微信公众号",
  "其他"
];

interface PaymentSourceSurveyProps {
  orderId: string;
  packageName: string;
  amountCents: number;
  paymentProvider: PaymentProvider;
  initialSubmitted?: boolean;
  onSubmittedChange?: (submitted: boolean) => void;
}

export function PaymentSourceSurvey({
  orderId,
  packageName,
  amountCents,
  paymentProvider,
  initialSubmitted = false,
  onSubmittedChange
}: PaymentSourceSurveyProps) {
  const storageKey = `imagegood:payment-source-survey:${orderId}`;
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = initialSubmitted || safeStorageGet(storageKey) === "submitted";
    setSubmitted(saved);
    onSubmittedChange?.(saved);
  }, [initialSubmitted, onSubmittedChange, storageKey]);

  const submit = async () => {
    if (!selected) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/analytics/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "acquisition_channel",
          path: "/checkout/source-survey",
          target: selected,
          metadata: {
            channel: selected,
            orderId,
            packageName,
            amountCents,
            paymentProvider
          },
          visitorId: safeBrowserId(window.localStorage, "imagegood_visitor_id"),
          sessionId: safeBrowserId(window.sessionStorage, "imagegood_session_id")
        })
      });

      if (!response.ok) {
        throw new Error("来源信息提交失败，请稍后重试");
      }

      safeStorageSet(storageKey, "submitted");
      setSubmitted(true);
      onSubmittedChange?.(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "来源信息提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-700">感谢反馈，祝你创作顺利。</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-bold text-ink">感谢你支持 ImageGood。</p>
      <h2 className="mt-2 text-lg font-bold text-ink">您了解到 ImageGood 的渠道是？</h2>
      <p className="mt-2 text-sm leading-6 text-muted">选填。你的反馈会帮助我们改进产品，不影响继续使用。</p>
      {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {SOURCE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              selected === option ? "border-studio-300 bg-studio-50 text-studio-700" : "border-line bg-white text-slate-600"
            }`}
            onClick={() => setSelected(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <Button className="mt-5" disabled={!selected} loading={submitting} onClick={submit}>
        提交，感谢你的反馈
      </Button>
    </Card>
  );
}
