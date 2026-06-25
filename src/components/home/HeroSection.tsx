"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { UploadDropzone } from "@/components/ui/UploadDropzone";
import { imageAssets } from "@/lib/image-assets";
import { useStudioStore } from "@/lib/studio-store";

export function HeroSection() {
  const router = useRouter();
  const setUploadedImage = useStudioStore((state) => state.setUploadedImage);

  return (
    <section className="relative overflow-hidden rounded-lg border border-white/70 bg-slate-950 px-5 py-14 shadow-soft lg:px-12 lg:py-20">
      <SmartImage
        src={imageAssets.heroBackground}
        alt="现代图片工作台背景"
        className="absolute inset-0 border-0 opacity-80"
        rounded={false}
      />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(8,13,34,0.92)_0%,rgba(20,33,80,0.74)_44%,rgba(255,255,255,0.12)_100%)]" />
      <div className="absolute inset-x-8 bottom-8 hidden h-28 rounded-lg bg-white/10 blur-3xl lg:block" />

      <div className="relative z-10 mx-auto max-w-5xl text-center text-white">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-medium backdrop-blur">
          <WandSparkles className="h-4 w-4 text-cyan-200" />
          ImageGood 图片工具
        </div>
        <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-[1.38] tracking-normal md:text-5xl md:leading-[1.32] lg:text-6xl lg:leading-[1.24]">
          <span className="block">用 ImageGood</span>
          <span className="block">快速生成高质量图片</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-200">
          支持 AI 修图、文生图和智能抠图，一站完成商品图、封面图、社媒配图和日常图片处理。
        </p>

        <div className="mx-auto mt-10 max-w-3xl rounded-lg border border-white/18 bg-white/14 p-3 shadow-2xl backdrop-blur-xl">
          <UploadDropzone
            compact
            title="上传图片，开始使用 ImageGood"
            subtitle="上传后进入编辑工作台，登录即可生成并保存结果"
            className="min-h-[260px] border-white/25 bg-white/90 text-ink"
            onImageSelected={(imageUrl, file) => {
              setUploadedImage(imageUrl, file);
              router.push("/editor");
            }}
          />
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/editor">
            <Button size="lg">
              开始修图
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/text-to-image">
            <Button size="lg" variant="secondary" className="border border-white/25 bg-white/10 text-white ring-white/20 hover:bg-white/18">
              生成图片
            </Button>
          </Link>
          <Link href="/remove-background">
            <Button size="lg" variant="secondary" className="border border-white/25 bg-white/10 text-white ring-white/20 hover:bg-white/18">
              一键抠图
            </Button>
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-200">
          {["AI 修图", "文生图", "智能抠图", "商品图生成", "封面海报", "生成记录保存"].map((item) => (
            <span key={item} className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-200" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
        {[imageAssets.edit1, imageAssets.product2, imageAssets.poster1].map((image, index) => (
          <div
            key={image}
            className="overflow-hidden rounded-lg border border-white/14 bg-white/10 p-2 shadow-2xl backdrop-blur"
          >
            <SmartImage
              src={image}
              alt={`生成效果 ${index + 1}`}
              className="h-44 w-full border-0"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
