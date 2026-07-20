"use client";

import Link from "next/link";
import { AlertCircle, Clock3, History, Layers3, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils";

export type GenerationLoadingTaskType =
  | "edit"
  | "text-to-image"
  | "remove-background"
  | "product"
  | "poster"
  | "image-enhance"
  | "object-remove";

type GenerationLoadingStatus = "pending" | "processing" | "saving" | "timeout";

interface GenerationLoadingPanelProps {
  taskType: GenerationLoadingTaskType;
  status?: GenerationLoadingStatus;
  taskId?: string;
  previewUrl?: string | null;
  className?: string;
  compact?: boolean;
  minHeightClassName?: string;
}

const taskTypeLabels: Record<GenerationLoadingTaskType, string> = {
  edit: "AI 修图",
  "text-to-image": "文生图",
  "remove-background": "智能抠图",
  product: "商品图生成",
  poster: "封面海报",
  "image-enhance": "图片增强",
  "object-remove": "去杂物"
};

const stageCopy: Record<GenerationLoadingTaskType, string[]> = {
  edit: ["正在提交图片", "正在分析原图", "正在理解修改需求", "正在保持主体并优化画面", "生成仍在继续，复杂图片可能需要更久"],
  "text-to-image": ["正在提交画面描述", "正在理解创作需求", "正在构建主体和场景", "正在完善光影、细节和风格", "生成仍在继续，复杂画面可能需要更久"],
  "remove-background": ["正在提交抠图任务", "正在识别主体边缘", "正在分离主体和背景", "正在优化透明边缘", "正在生成透明 PNG，请稍候"],
  product: ["正在提交商品素材", "正在分析商品主体", "正在构建商业摄影场景", "正在优化光影和材质", "商品图仍在生成中，请稍候"],
  poster: ["正在提交海报任务", "正在理解标题和用途", "正在构建背景与构图", "正在优化版式和视觉层次", "海报仍在生成中，请稍候"],
  "image-enhance": ["正在提交增强任务", "正在分析图片清晰度", "正在恢复细节和质感", "正在优化光影和观感", "增强仍在继续，请稍候"],
  "object-remove": ["正在提交处理任务", "正在分析画面元素", "正在移除指定对象", "正在自然补全背景细节", "处理仍在继续，请稍候"]
};

function secondsToStageIndex(seconds: number) {
  if (seconds < 10) return 0;
  if (seconds < 45) return 1;
  if (seconds < 105) return 2;
  if (seconds < 180) return 3;
  return 4;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest} 秒`;
  return `${minutes} 分 ${String(rest).padStart(2, "0")} 秒`;
}

function AbstractComposition({ taskType }: { taskType: GenerationLoadingTaskType }) {
  const isPoster = taskType === "poster";

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-100">
      <div className="generation-drift absolute left-[8%] top-[10%] h-[52%] w-[58%] rounded-[26px] border border-white/80 bg-white/70 shadow-xl" />
      <div className="generation-drift-delayed absolute right-[8%] top-[18%] h-[24%] w-[25%] rounded-2xl border border-neutral-200 bg-neutral-200/80" />
      <div className="generation-drift-delayed absolute bottom-[14%] right-[10%] h-[30%] w-[38%] rounded-[22px] border border-white/80 bg-white/80 shadow-lg" />
      <div className="absolute left-[14%] top-[18%] h-3 w-28 rounded-full bg-neutral-300/80" />
      <div className="absolute left-[14%] top-[25%] h-3 w-44 rounded-full bg-neutral-200/90" />
      {isPoster ? <div className="absolute bottom-[22%] left-[14%] h-16 w-[42%] rounded-xl border border-neutral-200 bg-neutral-900/90" /> : null}
    </div>
  );
}

export function GenerationLoadingPanel({
  taskType,
  status,
  taskId,
  previewUrl,
  className,
  compact = false,
  minHeightClassName
}: GenerationLoadingPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const derivedStatus: GenerationLoadingStatus = status ?? (elapsedSeconds >= 300 ? "timeout" : taskId ? "processing" : "pending");
  const stageText = stageCopy[taskType][secondsToStageIndex(elapsedSeconds)];
  const statusText = useMemo(() => {
    if (derivedStatus === "pending") return "任务已提交";
    if (derivedStatus === "saving") return "正在保存结果";
    if (derivedStatus === "timeout") return "仍在生成";
    return "图片生成中";
  }, [derivedStatus]);
  const showPreview = Boolean(previewUrl) && taskType !== "text-to-image" && taskType !== "poster";
  const checkerboard = taskType === "remove-background";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-950 shadow-sm",
        minHeightClassName,
        compact ? "min-h-[300px] md:min-h-[360px]" : "min-h-[380px] md:min-h-[500px]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("absolute inset-0", checkerboard && "generation-checkerboard")}>
        {showPreview && previewUrl ? (
          <SmartImage
            src={previewUrl}
            alt="正在处理的输入图片"
            className={cn(
              "absolute inset-0 h-full w-full rounded-none border-0",
              checkerboard ? "bg-transparent" : "bg-neutral-900"
            )}
            imageClassName="generation-preview-image scale-[1.035] object-cover opacity-65 blur-[1px]"
            priority
          />
        ) : (
          <AbstractComposition taskType={taskType} />
        )}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.48)_0%,rgba(10,10,10,0.05)_38%,rgba(10,10,10,0.78)_100%)]" />
      <div className="generation-breathe absolute left-1/2 top-[42%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/10 shadow-[0_0_80px_rgba(255,255,255,0.18)] backdrop-blur-sm" />
      <div className="generation-focus-frame absolute left-[12%] top-[18%] h-[48%] w-[76%] rounded-2xl border border-white/45 shadow-[0_0_0_999px_rgba(0,0,0,0.04)]" />
      <div className="generation-scan absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-xl" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 sm:p-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
          <Layers3 className="h-3.5 w-3.5" />
          {taskTypeLabels[taskType]}
        </span>
        <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
          {statusText}
        </span>
      </div>

      <div className="absolute left-1/2 top-[42%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-white">
        <div className="generation-icon-pulse flex h-14 w-14 items-center justify-center rounded-2xl border border-white/35 bg-black/20 backdrop-blur-md">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
        <h3 className="text-lg font-semibold sm:text-xl">{stageText}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/75 sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            已等待 {formatElapsed(elapsedSeconds)}
          </span>
          <span>通常约 2–4 分钟，复杂任务可能更久</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-white/60 sm:text-sm">生成完成后会自动展示结果，你也可以稍后在历史记录中查看。</p>
        {elapsedSeconds >= 120 ? (
          <Link href="/history" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white underline underline-offset-4 sm:text-sm">
            <History className="h-4 w-4" />
            稍后在历史记录查看
          </Link>
        ) : null}
      </div>
    </div>
  );
}

interface GenerationErrorPanelProps {
  message: string;
  onRetry?: () => void;
  className?: string;
  minHeightClassName?: string;
}

export function GenerationErrorPanel({
  message,
  onRetry,
  className,
  minHeightClassName = "min-h-[360px]"
}: GenerationErrorPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center",
        minHeightClassName,
        className
      )}
    >
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 shadow-sm">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-rose-700">生成失败，请稍后重试</h3>
        <p className="mt-2 text-sm leading-6 text-rose-600">{message || "图片处理失败，请调整输入后重新尝试。"}</p>
        {onRetry ? (
          <Button className="mt-5" variant="outline" onClick={onRetry}>
            <RefreshCcw className="h-4 w-4" />
            重新生成
          </Button>
        ) : null}
      </div>
    </div>
  );
}
