"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ImagePlus, Scissors, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { UploadDropzone } from "@/components/ui/UploadDropzone";
import { imageAssets } from "@/lib/image-assets";
import { useStudioStore } from "@/lib/studio-store";

const primaryActions = [
  { label: "开始修图", href: "/editor", icon: WandSparkles, primary: true },
  { label: "文生图", href: "/text-to-image", icon: ImagePlus, primary: false },
  { label: "一键抠图", href: "/remove-background", icon: Scissors, primary: false }
] as const;

export function CleanHeroSection() {
  const router = useRouter();
  const setUploadedImage = useStudioStore((state) => state.setUploadedImage);

  return (
    <section className="relative isolate overflow-hidden border-b border-neutral-200 bg-white">
      <SmartImage
        src={imageAssets.heroBackground}
        alt="ImageGood 图片创作工作台"
        className="absolute inset-0 -z-20 border-0 opacity-[0.12]"
        imageClassName="grayscale"
        rounded={false}
      />
      <div className="absolute inset-0 -z-10 bg-white/90" />

      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            AI 图片创作与处理工具
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.25] tracking-tight text-neutral-950 sm:text-5xl sm:leading-[1.2] lg:text-6xl lg:leading-[1.16]">
            用 ImageGood 快速完成
            <span className="block">AI 图片创作</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg sm:leading-8">
            上传图片或输入文字，即可完成修图、文生图、智能抠图、商品图和封面海报生成。
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {primaryActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <Button
                    size="lg"
                    variant={action.primary ? "primary" : "secondary"}
                    className="w-full min-w-[148px] sm:w-auto"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                    {action.primary ? <ArrowRight className="h-4 w-4" /> : null}
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="mx-auto mt-10 max-w-2xl border-t border-neutral-300 pt-6">
            <UploadDropzone
              compact
              title="点击上传图片"
              subtitle="上传后进入 AI 修图工作台"
              className="min-h-[190px] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
              onImageSelected={(imageUrl, file) => {
                setUploadedImage(imageUrl, file);
                router.push("/editor");
              }}
            />
          </div>

          <div className="mt-5 hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-500 sm:flex">
            {["生成成功后扣除积分", "结果自动保存", "支持手机上传"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-blue-600" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
