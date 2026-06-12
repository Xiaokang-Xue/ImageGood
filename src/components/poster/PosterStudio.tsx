"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MessageCircle, Newspaper, PenTool, Trophy } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { LayerPanel } from "@/components/poster/LayerPanel";
import { PosterCanvas } from "@/components/poster/PosterCanvas";
import { palettes, PosterSettings } from "@/components/poster/PosterSettings";
import { PosterVariants } from "@/components/poster/PosterVariants";
import { Card } from "@/components/ui/Card";
import { apiClient, getImageErrorMessage, isEmailNotVerifiedError, isUnauthorizedError } from "@/lib/api-client";
import { cn, sleep } from "@/lib/utils";
import type { PosterImageResult, PosterLayerKey, PosterLayerVisibility, PosterRatio, PosterStyle, PosterUsage } from "@/types/image";

const usageOptions: Array<{
  value: PosterUsage;
  label: string;
  icon: typeof Newspaper;
}> = [
  { value: "xiaohongshu", label: "小红书封面", icon: MessageCircle },
  { value: "wechat", label: "公众号首图", icon: Newspaper },
  { value: "community", label: "社群活动海报", icon: CalendarDays },
  { value: "course", label: "课程封面", icon: PenTool },
  { value: "checkin", label: "学习打卡图", icon: Trophy }
];

const usages: PosterUsage[] = ["xiaohongshu", "wechat", "community", "course", "checkin"];
const styles: PosterStyle[] = ["clean", "premium", "cute", "tech", "handdrawn"];
const ratios: PosterRatio[] = ["3:4", "1:1", "16:9", "9:16", "4:5"];
const defaultLayerVisibility: PosterLayerVisibility = {
  title: true,
  subtitle: true,
  decoration: true,
  background: true
};
const POSTER_DRAFT_STORAGE_KEY = "imagegood-poster-studio-draft";

function normalizeUsage(value?: string): PosterUsage {
  return usages.includes(value as PosterUsage) ? (value as PosterUsage) : "xiaohongshu";
}

function normalizeStyle(value?: string): PosterStyle {
  return styles.includes(value as PosterStyle) ? (value as PosterStyle) : "clean";
}

function normalizeRatio(value?: string): PosterRatio {
  return ratios.includes(value as PosterRatio) ? (value as PosterRatio) : "3:4";
}

interface PosterStudioProps {
  initialUsage?: string;
  initialStyle?: string;
  initialRatio?: string;
}

interface PosterStudioDraft {
  usage: PosterUsage;
  title: string;
  subtitle: string;
  style: PosterStyle;
  ratio: PosterRatio;
  paletteIndex: number;
  layerVisibility: PosterLayerVisibility;
  results: PosterImageResult[];
  activeResult: PosterImageResult | null;
  variantIndex: number;
}

export function PosterStudio({ initialUsage, initialStyle, initialRatio }: PosterStudioProps) {
  const [usage, setUsage] = useState<PosterUsage>(() => normalizeUsage(initialUsage));
  const [title, setTitle] = useState("7 天练出自然英语口语");
  const [subtitle, setSubtitle] = useState("每天 30 分钟 · 轻松开口说英语");
  const [style, setStyle] = useState<PosterStyle>(() => normalizeStyle(initialStyle));
  const [ratio, setRatio] = useState<PosterRatio>(() => normalizeRatio(initialRatio));
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [layerVisibility, setLayerVisibility] = useState<PosterLayerVisibility>(defaultLayerVisibility);
  const [results, setResults] = useState<PosterImageResult[]>([]);
  const [activeResult, setActiveResult] = useState<PosterImageResult | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POSTER_DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<PosterStudioDraft>;
        setUsage(initialUsage ? normalizeUsage(initialUsage) : normalizeUsage(draft.usage));
        setTitle(typeof draft.title === "string" ? draft.title : "7 天练出自然英语口语");
        setSubtitle(typeof draft.subtitle === "string" ? draft.subtitle : "每天 30 分钟 · 轻松开口说英语");
        setStyle(initialStyle ? normalizeStyle(initialStyle) : normalizeStyle(draft.style));
        setRatio(initialRatio ? normalizeRatio(initialRatio) : normalizeRatio(draft.ratio));
        setPaletteIndex(typeof draft.paletteIndex === "number" && palettes[draft.paletteIndex] ? draft.paletteIndex : 0);
        setLayerVisibility({
          ...defaultLayerVisibility,
          ...(draft.layerVisibility ?? {})
        });
        setResults(Array.isArray(draft.results) ? draft.results : []);
        setActiveResult(draft.activeResult ?? null);
        setVariantIndex(typeof draft.variantIndex === "number" ? draft.variantIndex : 0);
      } else {
        if (initialUsage) setUsage(normalizeUsage(initialUsage));
        if (initialStyle) setStyle(normalizeStyle(initialStyle));
        if (initialRatio) setRatio(normalizeRatio(initialRatio));
      }
    } catch {
      window.localStorage.removeItem(POSTER_DRAFT_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, [initialRatio, initialStyle, initialUsage]);

  useEffect(() => {
    if (!hydrated) return;

    const draft: PosterStudioDraft = {
      usage,
      title,
      subtitle,
      style,
      ratio,
      paletteIndex,
      layerVisibility,
      results,
      activeResult,
      variantIndex
    };

    try {
      window.localStorage.setItem(POSTER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Draft persistence is best effort; generation still works without local storage.
    }
  }, [activeResult, hydrated, layerVisibility, paletteIndex, ratio, results, style, subtitle, title, usage, variantIndex]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const [response] = await Promise.all([
        apiClient.createPosterImages({
          title,
          subtitle,
          usage,
          style,
          ratio
        }),
        sleep(1000)
      ]);

      let nextResults = response.results ?? [];
      if (nextResults.length === 0) {
        const task = await apiClient.waitForTaskDone(response.taskId);
        if (task.status === "failed") {
          throw new Error(task.errorMessage || "生成失败，请稍后重试");
        }

        const url = task.resultImages?.[0] || task.resultImageUrl;
        if (!url) {
          throw new Error("生成完成但未检测到结果图片");
        }

        nextResults = [
          {
            id: "poster-result-1",
            url,
            title: "生成结果"
          }
        ];
      }

      setResults(nextResults);
      setActiveResult(nextResults[0]);
      setVariantIndex(0);
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        window.location.href = "/login?redirect=/poster";
        return;
      }
      if (isEmailNotVerifiedError(requestError)) {
        setError(getImageErrorMessage(requestError));
        return;
      }
      setError(getImageErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLayer = (key: PosterLayerKey) => {
    setLayerVisibility((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">封面/海报生成器</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">输入标题与用途，快速生成可编辑封面</h1>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-line">
          {activeResult ? `当前版式：${activeResult.title}` : "生成后可选择背景"}
        </div>
      </div>

      {error ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {error.includes("积分不足") ? (
            <Link href="/pricing" className="text-studio-700 underline">
              购买积分
            </Link>
          ) : error.includes("邮箱验证") ? (
            <Link href="/account" className="text-studio-700 underline">
              前往账户中心
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="mb-6 rounded-lg border border-studio-200 bg-studio-50 px-4 py-3 text-sm font-semibold text-studio-700">
          图片生成中，可能需要较长时间，请不要关闭页面。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)_360px]">
        <Card className="p-5">
          <div className="mb-5">
            <p className="text-sm font-semibold text-studio-600">用途选择</p>
            <h2 className="mt-1 text-xl font-bold text-ink">选择发布场景</h2>
          </div>
          <div className="grid gap-3">
            {usageOptions.map((item) => {
              const Icon = item.icon;
              const active = usage === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition",
                    active
                      ? "border-studio-500 bg-studio-50 text-studio-700"
                      : "border-line bg-white text-slate-700 hover:border-studio-200 hover:bg-studio-50/60"
                  )}
                  onClick={() => setUsage(item.value)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </Card>

        <PosterCanvas
          title={title}
          subtitle={subtitle}
          usage={usage}
          style={style}
          ratio={ratio}
          palette={palettes[paletteIndex]}
          variantIndex={variantIndex}
          backgroundImage={activeResult?.url}
          layers={layerVisibility}
        />

        <div className="grid gap-6">
          <PosterSettings
            title={title}
            subtitle={subtitle}
            style={style}
            ratio={ratio}
            paletteIndex={paletteIndex}
            loading={loading}
            onTitleChange={setTitle}
            onSubtitleChange={setSubtitle}
            onStyleChange={setStyle}
            onRatioChange={setRatio}
            onPaletteChange={setPaletteIndex}
            onGenerate={handleGenerate}
          />
          <LayerPanel visibility={layerVisibility} onToggle={handleToggleLayer} />
        </div>
      </div>

      <div className="mt-6">
        <PosterVariants
          results={results}
          activeId={activeResult?.id}
          loading={loading}
          onSelect={(result, index) => {
            setActiveResult(result);
            setVariantIndex(index);
          }}
        />
      </div>
    </PageShell>
  );
}
