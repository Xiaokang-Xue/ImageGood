"use client";

import Link from "next/link";
import { AlertCircle, Clock3, History, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
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
  edit: ["正在分析原图", "正在理解修改需求", "正在保持主体并优化画面", "正在生成最终结果", "生成仍在继续，复杂图片可能需要更久"],
  "text-to-image": ["正在提交画面描述", "正在理解画面描述", "正在构建主体和场景", "正在完善光影、细节和风格", "生成仍在继续，复杂画面可能需要更久"],
  "remove-background": ["正在提交抠图任务", "正在识别主体边缘", "正在分离背景", "正在优化透明边缘", "生成透明 PNG 仍在继续，请稍候"],
  product: ["正在提交商品图任务", "正在分析商品主体", "正在构建商业摄影场景", "正在优化光影和质感", "商品图仍在生成中，复杂素材可能需要更久"],
  poster: ["正在提交海报任务", "正在理解标题和用途", "正在生成封面背景", "正在优化版式留白和视觉层次", "海报背景仍在生成中，请稍候"],
  "image-enhance": ["正在提交增强任务", "正在分析图片清晰度", "正在提升细节和质感", "正在优化光影和观感", "增强仍在继续，复杂图片可能需要更久"],
  "object-remove": ["正在提交去杂物任务", "正在分析画面元素", "正在移除指定对象", "正在自然补全背景细节", "处理仍在继续，复杂画面可能需要更久"]
};

function secondsToStageIndex(seconds: number) {
  if (seconds < 5) return 0;
  if (seconds < 15) return 1;
  if (seconds < 35) return 2;
  if (seconds < 60) return 3;
  return 4;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest} 秒`;
  return `${minutes} 分 ${String(rest).padStart(2, "0")} 秒`;
}

export function GenerationLoadingPanel({
  taskType,
  status,
  taskId,
  className,
  compact = false,
  minHeightClassName = "min-h-[520px]"
}: GenerationLoadingPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const derivedStatus: GenerationLoadingStatus = status ?? (elapsedSeconds >= 90 ? "timeout" : taskId ? "processing" : "pending");
  const stageText = stageCopy[taskType][secondsToStageIndex(elapsedSeconds)];
  const statusText = useMemo(() => {
    if (derivedStatus === "pending") return "任务已提交，正在排队";
    if (derivedStatus === "saving") return "正在保存结果";
    if (derivedStatus === "timeout") return "生成时间较长，可稍后在历史记录查看";
    return "图片生成中";
  }, [derivedStatus]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm",
        minHeightClassName,
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(15,23,42,0.06),transparent_34%),linear-gradient(180deg,#ffffff,rgba(248,250,252,0.92))]" />
      <div className="relative flex h-full min-h-[inherit] flex-col justify-between">
        <div className={cn("rounded-xl border border-neutral-200 bg-slate-50 p-4", compact ? "min-h-[180px]" : "min-h-[300px] sm:min-h-[360px]")}>
          <div className="grid h-full min-h-[inherit] gap-3">
            <div className="h-5 w-32 animate-pulse rounded-full bg-neutral-200" />
            <div className="grid flex-1 grid-cols-[1fr_0.62fr] gap-3">
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="h-full min-h-32 animate-pulse rounded-lg bg-gradient-to-br from-neutral-100 via-white to-neutral-200" />
              </div>
              <div className="grid gap-3">
                <div className="animate-pulse rounded-xl bg-neutral-200/70" />
                <div className="animate-pulse rounded-xl bg-neutral-100" />
                <div className="animate-pulse rounded-xl bg-neutral-200/70" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-3 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-3 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-3 animate-pulse rounded-full bg-neutral-200" />
            </div>
          </div>
        </div>

        <div className={cn("mx-auto w-full max-w-xl text-center", compact ? "mt-4" : "mt-6")}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
              {taskTypeLabels[taskType]}
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
              {statusText}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-bold text-neutral-950">{stageText}</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            生成完成后会自动展示结果。本次生成成功后消耗 1 积分，失败不扣积分。
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-neutral-500 sm:flex-row">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              已等待 {formatElapsed(elapsedSeconds)}
            </span>
            <span className="hidden text-neutral-300 sm:inline">/</span>
            <span>{elapsedSeconds < 60 ? "通常需要几十秒，请保持页面打开" : "复杂任务可能需要更久"}</span>
          </div>
          {elapsedSeconds >= 60 ? (
            <Link href="/history" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 underline underline-offset-4">
              <History className="h-4 w-4" />
              稍后在历史记录查看
            </Link>
          ) : null}
        </div>
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
        <p className="mt-2 text-xs font-semibold text-rose-500">失败任务不会扣除积分。</p>
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
