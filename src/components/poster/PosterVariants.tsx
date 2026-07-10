"use client";

import { CheckCircle2, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { GenerationErrorPanel, GenerationLoadingPanel } from "@/components/ui/GenerationLoadingPanel";
import { SmartImage } from "@/components/ui/SmartImage";
import { downloadImage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { PosterImageResult } from "@/types/image";

interface PosterVariantsProps {
  results: PosterImageResult[];
  activeId?: string;
  loading?: boolean;
  taskId?: string;
  error?: string;
  onRetry?: () => void;
  onSelect: (result: PosterImageResult, index: number) => void;
}

export function PosterVariants({ results, activeId, loading, taskId, error, onRetry, onSelect }: PosterVariantsProps) {
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-studio-600">更多版式推荐</p>
          <h2 className="mt-1 text-xl font-bold text-ink">候选海报缩略图</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {results.length} 个版式
        </span>
      </div>

      {loading ? (
        <GenerationLoadingPanel taskType="poster" taskId={taskId} minHeightClassName="min-h-[260px]" compact />
      ) : error ? (
        <GenerationErrorPanel message={error} onRetry={onRetry} minHeightClassName="min-h-[220px]" />
      ) : results.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
          <div>
            <p className="text-base font-semibold text-ink">生成后将在这里展示海报背景</p>
            <p className="mt-2 text-sm text-muted">输入标题和用途，即可生成可下载的封面背景。</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {results.map((result, index) => {
            const active = activeId === result.id;
            return (
              <div
                key={result.id}
                className={cn(
                  "group overflow-hidden rounded-lg border bg-white text-left transition hover:-translate-y-1 hover:shadow-card",
                  active ? "border-studio-500 shadow-lg shadow-indigo-500/15" : "border-line"
                )}
              >
                <button type="button" className="relative block w-full text-left" onClick={() => onSelect(result, index)}>
                  <SmartImage src={result.url} alt={result.title} className="h-44 w-full rounded-none border-0" />
                  {active ? (
                    <span className="absolute right-2 top-2 rounded-full bg-studio-600 p-1 text-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  ) : null}
                </button>
                <div className="flex items-center justify-between gap-2 px-3 py-3">
                  <button
                    type="button"
                    className="truncate text-left text-sm font-semibold text-ink"
                    onClick={() => onSelect(result, index)}
                  >
                    {result.title}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-slate-600 transition hover:border-studio-200 hover:bg-studio-50 hover:text-studio-700"
                    aria-label={`下载${result.title}`}
                    onClick={() => downloadImage(result.url)}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
