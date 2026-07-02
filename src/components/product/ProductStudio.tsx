"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  apiClient,
  getImageErrorMessage,
  imageUrlToUploadFile,
  isAbortError,
  isEmailNotVerifiedError,
  isPaymentSourceSurveyRequiredError,
  isUnauthorizedError
} from "@/lib/api-client";
import { forceNormalizeImageFileForUpload, isImageCompatibilityError } from "@/lib/client-image-normalizer";
import { isPersistableImageUrl, safeStorageGet, safeStorageRemove, safeStorageSet } from "@/lib/safe-client-storage";
import { industryTemplates } from "@/lib/studio-content";
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
const productTemplates: ProductTemplate[] = ["white-bg", "lifestyle", "festival", "social"];
const PRODUCT_DRAFT_STORAGE_KEY = "imagegood-product-studio-draft";
const industrySellingPointPresets: Record<string, string> = {
  "美妆个护": "突出质地、肤感、精致包装和日常护理场景，画面干净高级",
  "食品饮料": "突出新鲜感、口感联想、食材细节和自然光氛围",
  "3C 数码": "突出产品结构、材质细节、科技感和桌面使用场景",
  "家居日用": "突出生活氛围、空间搭配、实用性和温暖光线",
  "服饰鞋包": "突出材质纹理、穿搭场景、轮廓比例和品质感",
  "母婴玩具": "突出安全感、柔和色彩、亲和氛围和使用场景"
};

function normalizeProductTemplate(value?: string): ProductTemplate {
  return productTemplates.includes(value as ProductTemplate) ? (value as ProductTemplate) : "white-bg";
}

interface ProductStudioProps {
  initialTemplate?: string;
}

interface ProductStudioDraft {
  imageUrl: string | null;
  template: ProductTemplate;
  scene: ProductScene;
  style: ProductStyle;
  sellingPoints: string;
  selectedIndustry: string | null;
  ratio: ProductRatio;
  results: ProductImageResult[];
}

function persistableProductResults(results: ProductImageResult[]) {
  return results.filter((result) => isPersistableImageUrl(result.url)).slice(-8);
}

export function ProductStudio({ initialTemplate }: ProductStudioProps) {
  const router = useRouter();
  const setUploadedImage = useStudioStore((state) => state.setUploadedImage);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<ProductTemplate>(() => normalizeProductTemplate(initialTemplate));
  const [scene, setScene] = useState<ProductScene>("desk");
  const [style, setStyle] = useState<ProductStyle>("premium");
  const [sellingPoints, setSellingPoints] = useState("轻盈质感、细腻光泽、适合日常通勤使用");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [ratio, setRatio] = useState<ProductRatio>("1:1");
  const [results, setResults] = useState<ProductImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const pollingController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => pollingController.current?.abort();
  }, []);

  useEffect(() => {
    try {
      const raw = safeStorageGet(PRODUCT_DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<ProductStudioDraft>;
        setImageUrl(isPersistableImageUrl(draft.imageUrl) ? draft.imageUrl : null);
        setTemplate(initialTemplate ? normalizeProductTemplate(initialTemplate) : normalizeProductTemplate(draft.template));
        setScene(scenes.some((item) => item.value === draft.scene) ? (draft.scene as ProductScene) : "desk");
        setStyle(styles.some((item) => item.value === draft.style) ? (draft.style as ProductStyle) : "premium");
        setSellingPoints(typeof draft.sellingPoints === "string" ? draft.sellingPoints : "轻盈质感、细腻光泽、适合日常通勤使用");
        setSelectedIndustry(typeof draft.selectedIndustry === "string" ? draft.selectedIndustry : null);
        setRatio(ratios.includes(draft.ratio as ProductRatio) ? (draft.ratio as ProductRatio) : "1:1");
        setResults(Array.isArray(draft.results) ? persistableProductResults(draft.results) : []);
      } else if (initialTemplate) {
        setTemplate(normalizeProductTemplate(initialTemplate));
      }
    } catch {
      safeStorageRemove(PRODUCT_DRAFT_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, [initialTemplate]);

  useEffect(() => {
    if (!hydrated) return;

    const draft: ProductStudioDraft = {
      imageUrl: isPersistableImageUrl(imageUrl) ? imageUrl : null,
      template,
      scene,
      style,
      sellingPoints,
      selectedIndustry,
      ratio,
      results: persistableProductResults(results)
    };

    safeStorageSet(PRODUCT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [hydrated, imageUrl, template, scene, style, sellingPoints, selectedIndustry, ratio, results]);

  const handleGenerate = async () => {
    if (!imageFile && !imageUrl) {
      setError("请先上传商品图片");
      return;
    }

    setLoading(true);
    setError("");
    pollingController.current?.abort();
    const controller = new AbortController();
    pollingController.current = controller;
    try {
      const submitProduct = async (imageOverride?: File) => {
        const response = await apiClient.createProductImages({
          image: imageOverride ?? imageFile ?? undefined,
          imageUrl: imageOverride ? undefined : imageUrl ?? undefined,
          template,
          scene,
          style,
          sellingPoints: selectedIndustry ? `${sellingPoints}。行业方向：${selectedIndustry}` : sellingPoints,
          ratio
        });

        let nextResults = response.results ?? [];
        if (nextResults.length === 0) {
          const task = await apiClient.waitForTaskDone(response.taskId, { signal: controller.signal });
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

        return nextResults;
      };

      let nextResults: ProductImageResult[];
      try {
        nextResults = await submitProduct();
      } catch (firstError) {
        if (!isImageCompatibilityError(firstError)) {
          throw firstError;
        }

        const retrySourceFile = imageFile ?? (imageUrl ? await imageUrlToUploadFile(imageUrl, "product-input") : null);
        if (!retrySourceFile) {
          throw firstError;
        }

        const normalizedFile = await forceNormalizeImageFileForUpload(retrySourceFile);
        nextResults = await submitProduct(normalizedFile);
      }

      setResults(nextResults);
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      if (isUnauthorizedError(requestError)) {
        router.push("/login?redirect=/product");
        return;
      }
      if (isPaymentSourceSurveyRequiredError(requestError)) {
        router.push(requestError.actionUrl || "/pricing");
        return;
      }
      if (isEmailNotVerifiedError(requestError)) {
        setError(getImageErrorMessage(requestError));
        return;
      }
      if (isImageCompatibilityError(requestError)) {
        setError("系统已自动优化图片格式，但模型仍无法读取该图片，请更换图片后再试");
        return;
      }
      setError(getImageErrorMessage(requestError));
    } finally {
      if (pollingController.current === controller) {
        pollingController.current = null;
      }
      if (!controller.signal.aborted) setLoading(false);
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
          ) : error.includes("验证") ? (
            <Link href="/account" className="text-studio-700 underline">
              前往账户中心
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
              setError("");
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
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selectedIndustry === item
                  ? "border-studio-500 bg-studio-50 text-studio-700"
                  : "border-line bg-white text-slate-600 hover:border-studio-300 hover:bg-studio-50 hover:text-studio-700"
              }`}
              onClick={() => {
                setSelectedIndustry(item);
                setSellingPoints(industrySellingPointPresets[item] ?? `${item}商品，突出质感、卖点和使用场景`);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        {selectedIndustry ? (
          <p className="mt-4 text-sm font-medium text-studio-700">
            已应用「{selectedIndustry}」行业方向，可继续调整商品卖点后生成。
          </p>
        ) : null}
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
