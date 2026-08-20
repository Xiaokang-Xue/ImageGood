"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Download,
  History,
  Image as ImageIcon,
  MessageCircle,
  Newspaper,
  PenTool,
  Sparkles,
  Trophy
} from "lucide-react";
import { CreditPurchasePrompt, type CreditPurchasePromptVariant } from "@/components/billing/CreditPurchasePrompt";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GenerationErrorPanel, GenerationLoadingPanel } from "@/components/ui/GenerationLoadingPanel";
import { MobileToolActionBar } from "@/components/ui/MobileToolActionBar";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  apiClient,
  downloadImage,
  getImageErrorMessage,
  isAbortError,
  isEmailNotVerifiedError,
  isInsufficientCreditsError,
  isPaymentSourceSurveyRequiredError,
  isUnauthorizedError
} from "@/lib/api-client";
import { refreshCreditsAfterGeneration } from "@/lib/client-credit-feedback";
import { isPersistableImageUrl, safeStorageGet, safeStorageRemove, safeStorageSet } from "@/lib/safe-client-storage";
import { trialDownloadLabel } from "@/lib/trial-image";
import { cn } from "@/lib/utils";
import { clearWorkspaceDraftsOnReload, POSTER_DRAFT_STORAGE_KEY } from "@/lib/workspace-draft-storage";
import type { PosterImageResult, PosterUsage } from "@/types/image";

const usageOptions: Array<{
  value: PosterUsage;
  label: string;
  description: string;
  icon: typeof Newspaper;
}> = [
  { value: "xiaohongshu", label: "小红书封面", description: "适合内容分享与手机信息流", icon: MessageCircle },
  { value: "wechat", label: "公众号首图", description: "横向构图，适合文章头图", icon: Newspaper },
  { value: "community", label: "活动海报", description: "适合社群活动与通知传播", icon: CalendarDays },
  { value: "course", label: "课程封面", description: "适合课程、专栏与知识内容", icon: PenTool },
  { value: "checkin", label: "打卡封面", description: "适合计划、挑战与进度记录", icon: Trophy }
];

const usages = new Set<PosterUsage>(usageOptions.map((item) => item.value));

function normalizeUsage(value?: string): PosterUsage {
  return usages.has(value as PosterUsage) ? (value as PosterUsage) : "xiaohongshu";
}

interface PosterStudioProps {
  initialUsage?: string;
}

interface PosterStudioDraft {
  usage: PosterUsage;
  prompt: string;
  result: PosterImageResult | null;
}

function persistablePosterResult(result: PosterImageResult | null) {
  if (!result || !isPersistableImageUrl(result.url)) return null;
  const { previewUrl: _previewUrl, ...persistableResult } = result;
  return persistableResult;
}

export function PosterStudio({ initialUsage }: PosterStudioProps) {
  const router = useRouter();
  const [usage, setUsage] = useState<PosterUsage>(() => normalizeUsage(initialUsage));
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<PosterImageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [taskId, setTaskId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [mobileInputActive, setMobileInputActive] = useState(true);
  const [creditPrompt, setCreditPrompt] = useState<CreditPurchasePromptVariant | null>(null);
  const pollingController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => pollingController.current?.abort();
  }, []);

  useEffect(() => {
    clearWorkspaceDraftsOnReload();
    try {
      const raw = safeStorageGet(POSTER_DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<PosterStudioDraft>;
        setUsage(initialUsage ? normalizeUsage(initialUsage) : normalizeUsage(draft.usage));
        setPrompt(typeof draft.prompt === "string" ? draft.prompt : "");
        setResult(persistablePosterResult(draft.result ?? null));
      }
    } catch {
      safeStorageRemove(POSTER_DRAFT_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, [initialUsage]);

  useEffect(() => {
    if (!hydrated) return;
    safeStorageSet(
      POSTER_DRAFT_STORAGE_KEY,
      JSON.stringify({
        usage,
        prompt,
        result: persistablePosterResult(result)
      } satisfies PosterStudioDraft)
    );
  }, [hydrated, prompt, result, usage]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setCreditPrompt(null);
    setTaskId("");
    setMobileInputActive(false);
    pollingController.current?.abort();
    const controller = new AbortController();
    pollingController.current = controller;

    try {
      const response = await apiClient.createPosterImages({ usage, prompt });
      setTaskId(response.taskId);

      let nextResult = response.results?.[0] ?? null;
      if (!nextResult) {
        const task = await apiClient.waitForTaskDone(response.taskId, { signal: controller.signal });
        if (task.status === "failed") {
          throw new Error(task.errorMessage || "生成失败，请稍后重试");
        }

        const url = task.resultImages?.[0] || task.resultImageUrl;
        if (!url) throw new Error("生成完成但未检测到结果图片");
        nextResult = {
          id: task.id,
          url,
          previewUrl: task.resultImagePreviewUrls?.[0] || task.resultImagePreviewUrl || url,
          title: "封面生成结果"
        };
      }

      setResult(nextResult);
      setCreditPrompt((await refreshCreditsAfterGeneration()) ? "experience-complete" : null);
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      if (isUnauthorizedError(requestError)) {
        router.push("/login?redirect=/poster");
        return;
      }
      if (isPaymentSourceSurveyRequiredError(requestError)) {
        router.push(requestError.actionUrl || "/pricing");
        return;
      }
      if (isInsufficientCreditsError(requestError)) {
        setCreditPrompt("insufficient");
        setMobileInputActive(true);
        return;
      }
      setError(getImageErrorMessage(requestError));
      if (isEmailNotVerifiedError(requestError)) setMobileInputActive(true);
    } finally {
      if (pollingController.current === controller) pollingController.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const handleMobileAction = () => {
    if (loading) return;
    if (mobileInputActive) {
      void handleGenerate();
      return;
    }
    setError("");
    setMobileInputActive(true);
  };

  const horizontalResult = usage === "wechat" || usage === "course";

  return (
    <PageShell>
      <div className="mb-6">
        <p className="text-sm font-semibold text-studio-600">封面海报</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">选择用途，让 AI 完成整张封面</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          选择发布场景，可补充你想呈现的内容。构图、场景和视觉质感将由模型直接完成。
        </p>
      </div>

      {creditPrompt ? <CreditPurchasePrompt variant={creditPrompt} /> : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className={cn("p-5", !mobileInputActive && "hidden md:block")}>
          <div>
            <p className="text-sm font-semibold text-studio-600">封面类型</p>
            <h2 className="mt-1 text-xl font-bold text-ink">准备生成内容</h2>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {usageOptions.map((item) => {
              const Icon = item.icon;
              const active = usage === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition",
                    active
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-sm"
                      : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 hover:bg-neutral-50"
                  )}
                  onClick={() => setUsage(item.value)}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
                      active ? "border-white/20 bg-white/10" : "border-neutral-200 bg-neutral-100"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className={cn("mt-0.5 block text-xs", active ? "text-white/65" : "text-neutral-500")}>
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-neutral-800">画面描述（可选）</span>
            <textarea
              value={prompt}
              rows={5}
              maxLength={500}
              placeholder="例如：夏日海边旅行主题，清晨自然光，画面轻松通透"
              className="mt-2 w-full resize-none rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <span className="mt-1.5 block text-right text-xs text-neutral-400">{prompt.length}/500</span>
          </label>

          <Button className="mt-4 hidden w-full md:inline-flex" variant="dark" loading={loading} onClick={handleGenerate}>
            <Sparkles className="h-4 w-4" />
            AI 生成封面
          </Button>
        </Card>

        <Card className={cn("p-4 sm:p-5", mobileInputActive && "hidden md:block")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-studio-600">生成结果</p>
              <h2 className="mt-1 text-xl font-bold text-ink">完整封面预览</h2>
            </div>
            {result && !loading ? (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
                {usageOptions.find((item) => item.value === usage)?.label}
              </span>
            ) : null}
          </div>

          {loading ? (
            <GenerationLoadingPanel taskType="poster" taskId={taskId} minHeightClassName="min-h-[420px] md:min-h-[580px]" />
          ) : error ? (
            <GenerationErrorPanel message={error} onRetry={handleGenerate} minHeightClassName="min-h-[420px]" />
          ) : result ? (
            <div>
              <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 p-3 sm:p-5">
                <SmartImage
                  src={result.previewUrl || result.url}
                  fallbackSrc={result.url}
                  alt="AI 生成的封面海报"
                  priority
                  previewWidth={1280}
                  sizes="(min-width: 1280px) 760px, 100vw"
                  className={cn(
                    "w-full border-0 bg-white",
                    horizontalResult ? "aspect-[3/2] max-w-4xl" : "aspect-[2/3] max-h-[680px] max-w-[460px]"
                  )}
                  imageClassName="object-contain"
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button variant="dark" onClick={() => downloadImage(result.url, `imagegood-poster-${Date.now()}.png`)}>
                  <Download className="h-4 w-4" />
                  {trialDownloadLabel(result.url, "下载封面")}
                </Button>
                <Link href="/history">
                  <Button variant="outline" className="w-full">
                    <History className="h-4 w-4" />
                    查看历史记录
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center md:min-h-[580px]">
              <div className="max-w-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-800 shadow-sm">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">封面将在这里展示</h3>
                <p className="mt-2 text-sm leading-6 text-muted">选择封面类型后即可生成，额外描述不是必填项。</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <MobileToolActionBar
        label={mobileInputActive ? "AI 生成封面" : result ? "调整后再生成" : "返回修改"}
        helper={mobileInputActive ? "选择封面类型后即可生成完整成图" : "结果会自动保存到历史记录"}
        loading={loading}
        mode={mobileInputActive ? "generate" : "back"}
        onClick={handleMobileAction}
      />
    </PageShell>
  );
}
