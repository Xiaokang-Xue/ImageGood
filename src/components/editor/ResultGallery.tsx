"use client";

import Link from "next/link";
import { Download, History, PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GenerationErrorPanel, GenerationLoadingPanel } from "@/components/ui/GenerationLoadingPanel";
import { SmartImage } from "@/components/ui/SmartImage";
import { downloadImage } from "@/lib/api-client";
import type { EditImageResult } from "@/types/image";

interface ResultGalleryProps {
  results: EditImageResult[];
  selectedId?: string;
  loading?: boolean;
  taskId?: string;
  previewUrl?: string | null;
  error?: string;
  onSelect: (result: EditImageResult) => void;
  onContinueEdit?: (result: EditImageResult) => void;
  onRetry?: () => void;
}

export function ResultGallery({ results, loading, taskId, previewUrl, error, onSelect, onContinueEdit, onRetry }: ResultGalleryProps) {
  const mainResult = results[0];

  return (
    <Card className="min-h-[660px] p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-studio-600">生成结果</p>
          <h2 className="mt-1 text-xl font-bold text-ink">主结果预览</h2>
        </div>
        {mainResult ? (
          <span className="rounded-full bg-studio-50 px-3 py-1 text-xs font-semibold text-studio-700">
            已生成
          </span>
        ) : null}
      </div>

      {loading ? (
        <GenerationLoadingPanel taskType="edit" taskId={taskId} previewUrl={previewUrl} minHeightClassName="min-h-[360px] md:min-h-[520px]" />
      ) : error ? (
        <GenerationErrorPanel message={error} onRetry={onRetry} minHeightClassName="min-h-[520px]" />
      ) : !mainResult ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
          <div>
            <p className="text-lg font-bold text-ink">生成结果将在这里展示</p>
            <p className="mt-2 text-sm text-muted">上传图片并描述需求后，即可查看 AI 处理结果</p>
          </div>
        </div>
      ) : (
        <div>
          <div className="overflow-hidden rounded-2xl border border-line bg-slate-50 shadow-sm">
            <SmartImage
              src={mainResult.url}
              alt={mainResult.label || "生成结果"}
              priority
              className="h-[520px] w-full rounded-none border-0 bg-slate-50"
              imageClassName="object-contain p-4"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{mainResult.label || "生成结果"}</p>
              <p className="mt-1 text-xs text-muted">结果已保存，可下载或继续修改。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadImage(mainResult.url)}>
                <Download className="h-4 w-4" />
                下载图片
              </Button>
              <Button variant="outline" size="sm" onClick={() => (onContinueEdit ?? onSelect)(mainResult)}>
                <PenLine className="h-4 w-4" />
                继续修改
              </Button>
              <Link href="/history">
                <Button variant="dark" size="sm">
                  <History className="h-4 w-4" />
                  查看历史记录
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
