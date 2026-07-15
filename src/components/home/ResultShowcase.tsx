import Link from "next/link";
import { ArrowRight, Check, Download, History, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { imageAssetSets } from "@/lib/image-assets";

const workflow = [
  { title: "提供素材", description: "上传图片，或用一句话描述需要生成的画面。" },
  { title: "AI 处理", description: "任务在服务端完成，生成过程中可查看实时状态。" },
  { title: "保存结果", description: "成功结果自动进入历史记录，随时查看和下载。" }
];

export function ResultShowcase() {
  const comparisonImage = imageAssetSets.productScenes[0];

  return (
    <section className="border-b border-neutral-200 bg-neutral-50 py-16 sm:py-20">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
        <div>
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            <span className="md:hidden">清楚的创作过程</span>
            <span className="hidden md:inline">更少步骤，更清楚的创作过程</span>
          </h2>
          <p className="mt-4 hidden max-w-lg text-base leading-7 text-neutral-600 md:block">
            每个工具都遵循一致的输入、生成和下载流程。你不需要理解复杂模型参数，只需说明目标。
          </p>

          <div className="mt-8 space-y-5">
            {workflow.map((item, index) => (
              <div key={item.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs font-semibold text-neutral-700">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Link href="/editor" className="mt-8 inline-block">
            <Button>
              开始处理图片
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between border-b border-neutral-300 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-950 text-white">
                <WandSparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold text-neutral-900">画面增强</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              已完成
            </span>
          </div>

          <div className="grid grid-cols-2 bg-neutral-100">
            <div className="relative overflow-hidden">
              <SmartImage
                src={comparisonImage}
                alt="画面增强前"
                className="aspect-[4/3] w-full rounded-none border-0"
                imageClassName="scale-[1.02] saturate-[0.72] brightness-[0.82] blur-[0.8px]"
              />
              <span className="absolute left-3 top-3 rounded-md border border-white/70 bg-white/90 px-2.5 py-1 text-xs font-medium text-neutral-700 backdrop-blur">
                增强前
              </span>
            </div>
            <div className="relative overflow-hidden border-l border-white">
              <SmartImage
                src={comparisonImage}
                alt="画面增强后"
                className="aspect-[4/3] w-full rounded-none border-0"
                imageClassName="saturate-[1.04] contrast-[1.03]"
              />
              <span className="absolute left-3 top-3 rounded-md bg-neutral-950 px-2.5 py-1 text-xs font-medium text-white">
                增强后
              </span>
            </div>
          </div>

          <div className="grid gap-3 border-t border-neutral-300 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <Check className="h-4 w-4 text-emerald-600" />
              结果已保存到历史记录
            </p>
            <Link
              href="/history"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <History className="h-4 w-4" />
              查看记录
            </Link>
            <span className="inline-flex h-9 items-center justify-center gap-2 px-1 text-sm font-medium text-neutral-600">
              <Download className="h-4 w-4" />
              可下载高清结果
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
