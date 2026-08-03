import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { homepageComparisonAssets } from "@/lib/image-assets";

const comparisons = [
  {
    title: "商品背景优化",
    description: "保留杯子外观、比例和边缘，清理杂乱背景并统一商业光影。",
    src: homepageComparisonAssets.productBackground,
    alt: "同一只白色杯子从日常厨房背景优化为商业摄影背景的前后对比",
    before: "原始场景",
    after: "背景优化"
  },
  {
    title: "图片文字替换",
    description: "保持海报版式与构图不变，仅替换指定标题和活动时间。",
    src: homepageComparisonAssets.posterText,
    alt: "同一张活动海报替换标题和时间文字的前后对比",
    before: "原文字",
    after: "文字替换"
  },
  {
    title: "智能去杂物",
    description: "移除纸箱、线缆和零散物品，自然补全地板、墙面与光影。",
    src: homepageComparisonAssets.objectRemoval,
    alt: "同一室内场景移除杂物并自然补全背景的前后对比",
    before: "处理前",
    after: "处理后"
  }
];

export function ResultShowcase() {
  return (
    <section className="border-b border-neutral-200 bg-neutral-50 py-16 sm:py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-neutral-500">功能型修图效果</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
              改对细节，也保留原图
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-600">
              从背景、文字到画面元素，按要求完成局部修改，主体与构图保持一致。
            </p>
          </div>
          <Link href="/editor" className="shrink-0">
            <Button variant="dark">
              开始修图
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {comparisons.map((item) => (
            <article
              key={item.title}
              className="overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
            >
              <div className="relative overflow-hidden border-b border-neutral-300 bg-neutral-100">
                <SmartImage
                  src={item.src}
                  alt={item.alt}
                  className="aspect-[3/2] w-full rounded-none border-0 shadow-none"
                  imageClassName="object-cover"
                />
                <span className="absolute bottom-0 left-1/2 top-0 w-px bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" aria-hidden="true" />
                <span className="absolute left-3 top-3 rounded-md border border-white/60 bg-white/90 px-2.5 py-1 text-xs font-semibold text-neutral-700 backdrop-blur">
                  {item.before}
                </span>
                <span className="absolute right-3 top-3 rounded-md bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">
                  {item.after}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-base font-semibold text-neutral-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
