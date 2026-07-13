"use client";

import { Download, PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GenerationErrorPanel, GenerationLoadingPanel } from "@/components/ui/GenerationLoadingPanel";
import { SmartImage } from "@/components/ui/SmartImage";
import { downloadImage } from "@/lib/api-client";
import type { ProductImageResult } from "@/types/image";

interface ProductResultGridProps {
  results: ProductImageResult[];
  loading?: boolean;
  taskId?: string;
  previewUrl?: string | null;
  error?: string;
  onRetry?: () => void;
  onEdit: (result: ProductImageResult) => void;
}

export function ProductResultGrid({ results, loading, taskId, previewUrl, error, onRetry, onEdit }: ProductResultGridProps) {
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-studio-600">生成结果</p>
          <h2 className="mt-1 text-xl font-bold text-ink">商品图候选</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {results.length} 张
        </span>
      </div>

      {loading ? (
        <GenerationLoadingPanel taskType="product" taskId={taskId} previewUrl={previewUrl} minHeightClassName="min-h-[320px] md:min-h-[360px]" compact />
      ) : error ? (
        <GenerationErrorPanel message={error} onRetry={onRetry} minHeightClassName="min-h-[300px]" />
      ) : results.length === 0 ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
          <div>
            <p className="text-base font-semibold text-ink">生成后将在这里展示商品图</p>
            <p className="mt-2 text-sm text-muted">上传商品图片并设置场景参数，即可获得可下载的生成结果。</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {results.map((result) => (
            <div
              key={result.id}
              className="group overflow-hidden rounded-lg border border-line bg-white transition hover:-translate-y-1 hover:border-studio-200 hover:shadow-card"
            >
              <SmartImage src={result.url} alt={result.title} className="h-64 w-full rounded-none border-0" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-studio-600">{result.template}</p>
                    <h3 className="mt-1 font-semibold text-ink">{result.title}</h3>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink transition hover:border-studio-200 hover:bg-studio-50"
                    onClick={() => downloadImage(result.url)}
                  >
                    <Download className="h-4 w-4" />
                    下载
                  </button>
                  <Button variant="dark" size="sm" onClick={() => onEdit(result)}>
                    <PenLine className="h-4 w-4" />
                    编辑
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
