"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  FileImage,
  History,
  Images,
  RefreshCcw,
  Sparkles,
  Type,
  WandSparkles
} from "lucide-react";
import { CreditPurchasePrompt, type CreditPurchasePromptVariant } from "@/components/billing/CreditPurchasePrompt";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { UploadDropzone } from "@/components/ui/UploadDropzone";
import {
  apiClient,
  downloadImage,
  getImageErrorMessage,
  isAbortError,
  isContactNotVerifiedError,
  isInsufficientCreditsError,
  isPaymentSourceSurveyRequiredError,
  isUnauthorizedError
} from "@/lib/api-client";
import { refreshCreditsAfterGeneration } from "@/lib/client-credit-feedback";
import { getCurrentUserCached } from "@/lib/client-current-user";
import { trialDownloadLabel } from "@/lib/trial-image";
import { cn } from "@/lib/utils";

type BatchCategory = "image" | "text";
type BatchPattern = "repeat" | "paired";
type BatchCount = 1 | 2 | 4;
type BatchResultStatus = "idle" | "submitting" | "processing" | "succeeded" | "failed";

interface BatchInputItem {
  id: number;
  file: File | null;
  previewUrl: string;
  prompt: string;
}

interface BatchResultItem {
  id: number;
  status: BatchResultStatus;
  taskId: string;
  resultUrl: string;
  previewUrl: string;
  error: string;
}

const batchCounts: BatchCount[] = [1, 2, 4];
const initialInputs = (): BatchInputItem[] =>
  Array.from({ length: 4 }, (_, index) => ({ id: index, file: null, previewUrl: "", prompt: "" }));
const initialResults = (count: number): BatchResultItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index,
    status: "idle",
    taskId: "",
    resultUrl: "",
    previewUrl: "",
    error: ""
  }));

function BatchResultPlaceholder({ index, status }: { index: number; status: BatchResultStatus }) {
  const active = status === "submitting" || status === "processing";
  return (
    <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100">
      {active ? (
        <>
          <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,#f5f5f5_20%,#ffffff_42%,#ededed_64%,#f5f5f5_82%)] bg-[length:220%_100%]" />
          <div className="relative text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-neutral-900">
              {status === "submitting" ? "正在提交任务" : "图片生成中"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">第 {index + 1} 张完成后会自动展示</p>
          </div>
        </>
      ) : (
        <div className="text-center text-neutral-500">
          <FileImage className="mx-auto h-7 w-7" />
          <p className="mt-3 text-sm font-medium">结果 {index + 1}</p>
        </div>
      )}
    </div>
  );
}

export function BatchGenerationStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<BatchCategory>(searchParams.get("mode") === "text" ? "text" : "image");
  const [pattern, setPattern] = useState<BatchPattern>("repeat");
  const [count, setCount] = useState<BatchCount>(2);
  const [inputs, setInputs] = useState<BatchInputItem[]>(initialInputs);
  const [results, setResults] = useState<BatchResultItem[]>(() => initialResults(2));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [errorActionHref, setErrorActionHref] = useState("");
  const [creditPrompt, setCreditPrompt] = useState<CreditPurchasePromptVariant | null>(null);
  const previewsRef = useRef(new Set<string>());
  const pollingController = useRef<AbortController | null>(null);

  useEffect(() => {
    const ownedPreviews = previewsRef.current;
    return () => {
      pollingController.current?.abort();
      ownedPreviews.forEach((url) => URL.revokeObjectURL(url));
      ownedPreviews.clear();
    };
  }, []);

  useEffect(() => {
    setResults(initialResults(count));
    setError("");
    setCreditPrompt(null);
  }, [category, count, pattern]);

  useEffect(() => {
    if (generating) return;
    const requestedCategory = searchParams.get("mode") === "text" ? "text" : "image";
    setCategory(requestedCategory);
  }, [generating, searchParams]);

  const inputCount = pattern === "repeat" ? 1 : count;
  const visibleInputs = useMemo(() => inputs.slice(0, inputCount), [inputCount, inputs]);

  const updateInput = (index: number, patch: Partial<BatchInputItem>) => {
    setInputs((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const selectImage = (index: number, previewUrl: string, file: File) => {
    const previous = inputs[index]?.previewUrl;
    if (previous?.startsWith("blob:")) {
      URL.revokeObjectURL(previous);
      previewsRef.current.delete(previous);
    }
    if (previewUrl.startsWith("blob:")) previewsRef.current.add(previewUrl);
    updateInput(index, { previewUrl, file });
    setResults(initialResults(count));
    setError("");
  };

  const validateInputs = () => {
    for (let index = 0; index < inputCount; index += 1) {
      const item = inputs[index];
      if (category === "image" && !item.file) return `请上传第 ${index + 1} 张原图`;
      if (item.prompt.trim().length < 4) return `请完善第 ${index + 1} 份图片描述`;
    }
    return "";
  };

  const updateResult = (index: number, patch: Partial<BatchResultItem>) => {
    setResults((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const runResult = async (index: number, controller: AbortController) => {
    const sourceIndex = pattern === "repeat" ? 0 : index;
    const input = inputs[sourceIndex];
    updateResult(index, { status: "submitting", taskId: "", resultUrl: "", previewUrl: "", error: "" });

    try {
      const response = category === "image"
        ? await apiClient.editImage({
            image: input.file || undefined,
            prompt: input.prompt.trim(),
            tool: "custom",
            size: "auto",
            quality: "auto",
            outputFormat: "png",
            returnPath: "/batch?mode=image"
          })
        : await apiClient.createTextToImage({
            prompt: input.prompt.trim(),
            size: "auto",
            quality: "auto",
            outputFormat: "png",
            returnPath: "/batch?mode=text"
          });

      updateResult(index, { status: "processing", taskId: response.taskId });
      const task = await apiClient.waitForTaskDone(response.taskId, { signal: controller.signal });
      if (task.status === "failed") throw new Error(task.errorMessage || "图片生成失败，请稍后重试");
      const resultUrl = task.resultImages?.[0] || task.resultImageUrl || "";
      if (!resultUrl) throw new Error("生成完成但未检测到结果图片");
      updateResult(index, {
        status: "succeeded",
        resultUrl,
        previewUrl: task.resultImagePreviewUrls?.[0] || task.resultImagePreviewUrl || resultUrl,
        error: ""
      });
      return true;
    } catch (requestError) {
      if (isAbortError(requestError)) return false;
      if (isUnauthorizedError(requestError)) {
        router.push(`/login?redirect=${encodeURIComponent(`/batch?mode=${category}`)}`);
        return false;
      }
      if (isPaymentSourceSurveyRequiredError(requestError)) {
        router.push(requestError.actionUrl || "/pricing");
        return false;
      }
      if (isInsufficientCreditsError(requestError)) {
        setCreditPrompt("insufficient");
      }
      if (isContactNotVerifiedError(requestError)) {
        setErrorActionHref("/account");
      }
      const message = getImageErrorMessage(requestError);
      updateResult(index, { status: "failed", error: message });
      return false;
    }
  };

  const runIndexes = async (indexes: number[]) => {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      setErrorActionHref("");
      return;
    }

    const user = await getCurrentUserCached({ force: true });
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/batch?mode=${category}`)}`);
      return;
    }
    if (!user.hasVerifiedContact) {
      setError("请先完成手机号或邮箱验证后再使用该功能");
      setErrorActionHref("/account");
      return;
    }
    if (!user.membershipUnlimited && user.credits < indexes.length) {
      setError("");
      setErrorActionHref("");
      setCreditPrompt("insufficient");
      return;
    }

    setGenerating(true);
    setError("");
    setErrorActionHref("");
    setCreditPrompt(null);
    pollingController.current?.abort();
    const controller = new AbortController();
    pollingController.current = controller;

    const completed = await Promise.all(indexes.map((index) => runResult(index, controller)));
    if (completed.some(Boolean)) {
      setCreditPrompt((await refreshCreditsAfterGeneration()) ? "experience-complete" : null);
    }
    if (pollingController.current === controller) pollingController.current = null;
    if (!controller.signal.aborted) setGenerating(false);
  };

  const switchCategory = (next: BatchCategory) => {
    if (generating || next === category) return;
    setCategory(next);
    router.replace(`/batch?mode=${next}`, { scroll: false });
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-neutral-500">批量生成</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-950">一次准备，生成多张图片</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            支持一份输入生成多张结果，也支持多份图片和描述逐项对应生成。
          </p>
        </div>
        <Link href="/history">
          <Button variant="outline"><History className="h-4 w-4" />查看历史记录</Button>
        </Link>
      </div>

      {error ? (
        <div className="mb-5 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {errorActionHref ? <Link href={errorActionHref} className="underline">前往账户中心</Link> : null}
        </div>
      ) : null}
      {creditPrompt ? <CreditPurchasePrompt variant={creditPrompt} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Card className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1">
            {([
              { value: "image" as const, label: "图片处理", icon: WandSparkles },
              { value: "text" as const, label: "文生图", icon: Type }
            ]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={generating}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition",
                    category === item.value ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
                  )}
                  onClick={() => switchCategory(item.value)}
                >
                  <Icon className="h-4 w-4" />{item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-neutral-900">生成方式</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={generating}
                className={cn("rounded-lg border px-3 py-3 text-left transition", pattern === "repeat" ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500")}
                onClick={() => setPattern("repeat")}
              >
                <span className="block text-sm font-semibold">同一份输入</span>
                <span className={cn("mt-1 block text-xs", pattern === "repeat" ? "text-neutral-300" : "text-neutral-500")}>生成多张不同结果</span>
              </button>
              <button
                type="button"
                disabled={generating}
                className={cn("rounded-lg border px-3 py-3 text-left transition", pattern === "paired" ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500")}
                onClick={() => setPattern("paired")}
              >
                <span className="block text-sm font-semibold">逐项对应</span>
                <span className={cn("mt-1 block text-xs", pattern === "paired" ? "text-neutral-300" : "text-neutral-500")}>每张使用独立输入</span>
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-900">生成张数</p>
            <div className="flex rounded-lg border border-neutral-300 bg-white p-1">
              {batchCounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={generating}
                  className={cn("h-8 min-w-10 rounded-md px-3 text-sm font-semibold transition", count === value ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100")}
                  onClick={() => setCount(value)}
                >
                  {value} 张
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {visibleInputs.map((input, index) => (
              <div key={input.id} className="rounded-lg border border-neutral-300 bg-neutral-50 p-3">
                {pattern === "paired" ? <p className="mb-3 text-xs font-semibold text-neutral-500">第 {index + 1} 项</p> : null}
                {category === "image" ? (
                  <UploadDropzone
                    value={input.previewUrl}
                    title="上传原图"
                    subtitle=""
                    compact
                    disabled={generating}
                    className="min-h-[190px]"
                    onImageSelected={(previewUrl, file) => selectImage(index, previewUrl, file)}
                  />
                ) : null}
                <textarea
                  value={input.prompt}
                  disabled={generating}
                  placeholder={category === "image" ? "描述希望如何修改这张图片" : "描述希望生成的主体、场景和画面氛围"}
                  className={cn(
                    "min-h-[104px] w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-3 text-sm leading-6 text-neutral-950 outline-none transition focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10",
                    category === "image" && "mt-3"
                  )}
                  onChange={(event) => updateInput(index, { prompt: event.target.value })}
                />
              </div>
            ))}
          </div>

          <Button className="mt-5 w-full" size="lg" loading={generating} onClick={() => void runIndexes(Array.from({ length: count }, (_, index) => index))}>
            <Images className="h-4 w-4" />生成 {count} 张图片
          </Button>
          <p className="mt-3 text-center text-xs text-neutral-500">成功一张消耗一张可用额度，失败不消耗</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-500">批量结果</p>
              <h2 className="mt-1 text-xl font-bold text-neutral-950">每张任务独立保存</h2>
            </div>
            <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-600">{count} 张</span>
          </div>

          <div className={cn("grid gap-4", count > 1 && "md:grid-cols-2")}>
            {results.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-neutral-300 bg-white p-3">
                {item.status === "succeeded" && item.resultUrl ? (
                  <SmartImage
                    src={item.previewUrl || item.resultUrl}
                    fallbackSrc={item.resultUrl}
                    alt={`批量生成结果 ${index + 1}`}
                    previewWidth={720}
                    sizes="(min-width: 768px) 40vw, 100vw"
                    loadingLabel="正在加载结果…"
                    className="h-[300px] w-full bg-neutral-100"
                    imageClassName="object-contain"
                  />
                ) : item.status === "failed" ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-5 text-center">
                    <p className="text-sm font-semibold text-rose-700">第 {index + 1} 张生成失败</p>
                    <p className="mt-2 text-xs leading-5 text-rose-600">{item.error}</p>
                    <Button className="mt-4" size="sm" variant="outline" disabled={generating} onClick={() => void runIndexes([index])}>
                      <RefreshCcw className="h-4 w-4" />重试这一张
                    </Button>
                  </div>
                ) : (
                  <BatchResultPlaceholder index={index} status={item.status} />
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                    {item.status === "succeeded" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
                    {item.status === "succeeded" ? "已完成" : item.status === "failed" ? "生成失败" : item.status === "idle" ? "等待生成" : "生成中"}
                  </span>
                  {item.resultUrl ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                      onClick={() => downloadImage(item.resultUrl, `imagegood-batch-${Date.now()}-${index + 1}.png`)}
                    >
                      <Download className="h-3.5 w-3.5" />{trialDownloadLabel(item.resultUrl)}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
