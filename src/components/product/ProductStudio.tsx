"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, SlidersHorizontal } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ProductResultGrid } from "@/components/product/ProductResultGrid";
import { ProductTemplateSelector } from "@/components/product/ProductTemplateSelector";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { UploadDropzone } from "@/components/ui/UploadDropzone";
import { apiClient, getImageErrorMessage, isUnauthorizedError } from "@/lib/api-client";
import { industryTemplates } from "@/lib/studio-content";
import { sleep } from "@/lib/utils";
import { useStudioStore } from "@/lib/studio-store";
import type {
  ProductImageResult,
  ProductRatio,
  ProductScene,
  ProductStyle,
  ProductTemplate
} from "@/types/image";

const scenes: Array<{ label: string; value: ProductScene }> = [
  { label: "厨房", value: "kitchen" },
  { label: "卧室", value: "bedroom" },
  { label: "办公桌", value: "desk" },
  { label: "户外", value: "outdoor" },
  { label: "礼盒", value: "gift" }
];

const styles: Array<{ label: string; value: ProductStyle }> = [
  { label: "简约", value: "minimal" },
  { label: "高级", value: "premium" },
  { label: "温暖", value: "warm" },
  { label: "清新", value: "fresh" }
];

const ratios: ProductRatio[] = ["1:1", "3:4", "4:3", "16:9"];

export function ProductStudio() {
  const router = useRouter();
  const setUploadedImage = useStudioStore((state) => state.setUploadedImage);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<ProductTemplate>("white-bg");
  const [scene, setScene] = useState<ProductScene>("desk");
  const [style, setStyle] = useState<ProductStyle>("premium");
  const [sellingPoints, setSellingPoints] = useState("轻盈质感、细腻光泽、适合日常通勤使用");
  const [ratio, setRatio] = useState<ProductRatio>("1:1");
  const [results, setResults] = useState<ProductImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!imageFile) {
      setError("请先上传商品图片");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [response] = await Promise.all([
        apiClient.createProductImages({
          image: imageFile,
          imageUrl: imageUrl ?? undefined,
          template,
          scene,
          style,
          sellingPoints,
          ratio
        }),
        sleep(1000)
      ]);

      let nextResults = response.results ?? [];
      if (nextResults.length === 0) {
        const task = await apiClient.waitForTaskDone(response.taskId);
        if (task.status === "failed") {
          throw new Error(task.errorMessage || "生成失败，请稍后重试");
        }

        const url = task.resultImages?.[0] || task.resultImageUrl;
        if (!url) {
          throw new Error("生成完成但未检测到结果图片");
        }

        nextResults = [
          {
            id: "product-result-1",
            url,
            template: "商品图",
            title: "生成结果"
          }
        ];
      }

      setResults(nextResults);
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.push("/login?redirect=/product");
        return;
      }
      setError(getImageErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (result: ProductImageResult) => {
    setUploadedImage(result.url);
    router.push("/editor");
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">商品图工作室</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">从一张商品原图生成多场景营销素材</h1>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-line">
          白底主图、生活场景、节日促销、种草封面
        </div>
      </div>

      {error ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {error.includes("积分不足") ? (
            <Link href="/pricing" className="text-studio-700 underline">
              购买积分
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="mb-6 rounded-lg border border-studio-200 bg-studio-50 px-4 py-3 text-sm font-semibold text-studio-700">
          图片生成中，可能需要较长时间，请不要关闭页面。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <ImagePlus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-studio-600">商品原图</p>
              <h2 className="text-xl font-bold text-ink">上传素材</h2>
            </div>
          </div>
          <UploadDropzone
            value={imageUrl}
            compact
            title="上传商品图"
            subtitle="建议使用主体清晰、背景简洁的产品照片"
            className="min-h-[420px]"
            onImageSelected={(url, file) => {
              setImageUrl(url);
              setImageFile(file);
            }}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-5">
            <p className="text-sm font-semibold text-studio-600">模板选择</p>
            <h2 className="mt-1 text-xl font-bold text-ink">选择出图目标</h2>
          </div>
          <ProductTemplateSelector value={template} onChange={setTemplate} />

          <div className="mt-6 overflow-hidden rounded-lg border border-line bg-slate-50">
            {imageUrl ? (
              <SmartImage src={imageUrl} alt="商品图预览" className="h-[250px] w-full rounded-none border-0" />
            ) : (
              <div className="flex h-[250px] items-center justify-center px-6 text-center text-sm font-semibold text-slate-500">
                上传商品图后，将在这里预览当前素材
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-button-gradient text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-studio-600">生成参数</p>
              <h2 className="text-xl font-bold text-ink">控制画面方向</h2>
            </div>
          </div>

          <SelectGroup title="场景选择" value={scene} options={scenes} onChange={setScene} />
          <SelectGroup title="风格选择" value={style} options={styles} onChange={setStyle} />

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-700">商品卖点</span>
            <textarea
              value={sellingPoints}
              onChange={(event) => setSellingPoints(event.target.value)}
              rows={4}
              placeholder="输入商品亮点，例如：便携、保湿、长续航、礼盒感"
              className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
            />
          </label>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">图片比例</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {ratios.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    ratio === item
                      ? "border-studio-500 bg-studio-50 text-studio-700"
                      : "border-line bg-white text-slate-600 hover:border-studio-200"
                  }`}
                  onClick={() => setRatio(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <Button className="mt-6 w-full" size="lg" loading={loading} onClick={handleGenerate}>
            {loading ? "生成中..." : "生成商品图"}
          </Button>
        </Card>
      </div>

      <div className="mt-6">
        <ProductResultGrid results={results} loading={loading} onEdit={handleEdit} />
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-studio-600">热门行业模板</p>
            <h2 className="mt-1 text-xl font-bold text-ink">常见行业可快速复用</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {industryTemplates.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-studio-300 hover:bg-studio-50 hover:text-studio-700"
            >
              {item}
            </button>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}

function SelectGroup<T extends string>({
  title,
  value,
  options,
  onChange
}: {
  title: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              value === option.value
                ? "border-studio-500 bg-studio-50 text-studio-700"
                : "border-line bg-white text-slate-600 hover:border-studio-200"
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
