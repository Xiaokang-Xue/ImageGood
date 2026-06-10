"use client";

import Link from "next/link";
import { Download, History, PenLine, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { downloadImage } from "@/lib/api-client";
import type { EditImageResult } from "@/types/image";

interface ResultGalleryProps {
  results: EditImageResult[];
  selectedId?: string;
  loading?: boolean;
  error?: string;
  onSelect: (result: EditImageResult) => void;
  onContinueEdit?: (result: EditImageResult) => void;
  onRetry?: () => void;
}

export function ResultGallery({ results, loading, error, onSelect, onContinueEdit, onRetry }: ResultGalleryProps) {
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
        <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-line bg-slate-50 px-6 text-center">
          <div>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-studio-100 border-t-studio-600" />
            <p className="mt-5 text-lg font-bold text-ink">图片生成中，请稍候</p>
            <p className="mt-2 text-sm text-muted">正在处理图片细节，完成后会自动展示结果。</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 text-center">
          <div className="max-w-md">
            <p className="text-lg font-bold text-rose-700">生成失败，请稍后重试</p>
            <p className="mt-2 text-sm leading-6 text-rose-600">{error}</p>
            {onRetry ? (
              <Button className="mt-5" variant="outline" onClick={onRetry}>
                <RefreshCcw className="h-4 w-4" />
                重试
              </Button>
            ) : null}
          </div>
        </div>
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
