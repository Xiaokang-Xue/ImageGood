"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, History, Sparkles, UploadCloud } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GenerationErrorPanel, GenerationLoadingPanel, type GenerationLoadingTaskType } from "@/components/ui/GenerationLoadingPanel";
import { SmartImage } from "@/components/ui/SmartImage";
import { UploadDropzone } from "@/components/ui/UploadDropzone";
import {
  apiClient,
  downloadImage,
  getImageErrorMessage,
  ImageApiClientError,
  isAbortError,
  isContactNotVerifiedError,
  isInsufficientCreditsError,
  isPaymentSourceSurveyRequiredError,
  isUnauthorizedError
} from "@/lib/api-client";

interface SingleImageEditToolStudioProps {
  endpoint: string;
  loginRedirect: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  uploadTitle: string;
  uploadSubtitle: string;
  buttonLabel: string;
  processingTitle: string;
  emptyResultTitle: string;
  emptyResultDescription: string;
  resultAlt: string;
  downloadName: string;
  taskType?: GenerationLoadingTaskType;
  defaultPrompt?: string;
  promptLabel?: string;
  promptPlaceholder?: string;
  promptRequired?: boolean;
  relatedTools?: Array<{ label: string; href: string }>;
}

async function createToolTask(endpoint: string, input: { image: File; prompt: string }) {
  const formData = new FormData();
  formData.append("image", input.image);
  formData.append("prompt", input.prompt);
  formData.append("size", "1024x1024");
  formData.append("quality", "auto");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as
    | { taskId?: string }
    | { error?: { code?: string; message?: string; actionUrl?: string; orderId?: string } }
    | null;

  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    throw new ImageApiClientError(error?.code || "REQUEST_FAILED", error?.message || `请求失败：${response.status}`, {
      actionUrl: error?.actionUrl,
      orderId: error?.orderId
    });
  }

  if (!payload || !("taskId" in payload) || !payload.taskId) {
    throw new ImageApiClientError("TASK_CREATE_FAILED", "创建图片任务失败，请稍后重试");
  }

  return { taskId: payload.taskId };
}

export function SingleImageEditToolStudio({
  endpoint,
  loginRedirect,
  eyebrow,
  title,
  subtitle,
  uploadTitle,
  uploadSubtitle,
  buttonLabel,
  emptyResultTitle,
  emptyResultDescription,
  resultAlt,
  downloadName,
  taskType = "edit",
  defaultPrompt = "",
  promptLabel,
  promptPlaceholder,
  promptRequired = false,
  relatedTools = []
}: SingleImageEditToolStudioProps) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorActionHref, setErrorActionHref] = useState("");
  const [taskId, setTaskId] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const pollingController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => pollingController.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleGenerate = async () => {
    if (!imageFile) {
      setError("请先上传需要处理的图片");
      setErrorActionHref("");
      return;
    }
    if (promptRequired && prompt.trim().length < 2) {
      setError("请描述需要处理的内容");
      setErrorActionHref("");
      return;
    }

    setLoading(true);
    setError("");
    setErrorActionHref("");
    setTaskId("");
    setResultUrl("");
    pollingController.current?.abort();
    const controller = new AbortController();
    pollingController.current = controller;

    try {
      const response = await createToolTask(endpoint, {
        image: imageFile,
        prompt: prompt.trim()
      });
      setTaskId(response.taskId);

      const task = await apiClient.waitForTaskDone(response.taskId, { signal: controller.signal });
      if (task.status === "failed") {
        throw new Error(task.errorMessage || "处理失败，请稍后重试");
      }

      const url = task.resultImages?.[0] || task.resultImageUrl;
      if (!url) {
        throw new Error("处理完成但未检测到结果图片");
      }

      setResultUrl(url);
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      if (isUnauthorizedError(requestError)) {
        router.push(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
        return;
      }
      if (isPaymentSourceSurveyRequiredError(requestError)) {
        router.push(requestError.actionUrl || "/pricing");
        return;
      }
      setErrorActionHref(
        isInsufficientCreditsError(requestError) ? "/pricing" : isContactNotVerifiedError(requestError) ? "/account" : ""
      );
      setError(getImageErrorMessage(requestError));
    } finally {
      if (pollingController.current === controller) {
        pollingController.current = null;
      }
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p>
        </div>
        <Link href="/history">
          <Button variant="outline">
            <History className="h-4 w-4" />
            查看历史记录
          </Button>
        </Link>
      </div>

      {error ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {errorActionHref ? (
            <Link href={errorActionHref} className="text-studio-700 underline">
              {errorActionHref === "/pricing" ? "购买积分" : "前往账户中心"}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-button-gradient text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">{uploadTitle}</h2>
              <p className="mt-1 text-sm text-muted">成功处理消耗 1 个积分，失败不扣积分。</p>
            </div>
          </div>

          <UploadDropzone
            value={imageUrl}
            title={uploadTitle}
            subtitle={uploadSubtitle}
            className="min-h-[360px]"
            onImageSelected={(previewUrl, file) => {
              if (imageUrl.startsWith("blob:")) {
                URL.revokeObjectURL(imageUrl);
              }
              setImageUrl(previewUrl);
              setImageFile(file);
              setResultUrl("");
              setError("");
            }}
          />

          {promptLabel ? (
            <div className="mt-5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="tool-prompt">
                {promptLabel}
              </label>
              <textarea
                id="tool-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={promptPlaceholder}
                className="mt-2 min-h-[116px] w-full resize-none rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
              />
            </div>
          ) : null}

          <Button className="mt-6 w-full" size="lg" loading={loading} onClick={handleGenerate}>
            {buttonLabel}
          </Button>

          {relatedTools.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {relatedTools.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-studio-200 hover:bg-studio-50">
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-studio-600">处理结果</p>
              <h2 className="mt-1 text-xl font-bold text-ink">作品预览</h2>
            </div>
            {loading && taskId ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">任务处理中</span> : null}
          </div>

          <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-line bg-slate-50 p-4">
            {loading ? (
              <GenerationLoadingPanel taskType={taskType} taskId={taskId} minHeightClassName="min-h-[500px]" className="w-full" />
            ) : error ? (
              <GenerationErrorPanel message={error} onRetry={handleGenerate} minHeightClassName="min-h-[500px]" className="w-full" />
            ) : resultUrl ? (
              <SmartImage
                src={resultUrl}
                alt={resultAlt}
                className="h-[620px] max-h-[70vh] w-full rounded-lg border-line bg-white"
                imageClassName="object-contain"
              />
            ) : imageUrl ? (
              <SmartImage
                src={imageUrl}
                alt="上传预览"
                className="h-[620px] max-h-[70vh] w-full rounded-lg border-line bg-white"
                imageClassName="object-contain"
              />
            ) : (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white text-studio-600 shadow-sm ring-1 ring-line">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <p className="mt-4 text-lg font-bold text-ink">{emptyResultTitle}</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{emptyResultDescription}</p>
              </div>
            )}
          </div>

          {resultUrl ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1" variant="dark" onClick={() => downloadImage(resultUrl, downloadName)}>
                <Download className="h-4 w-4" />
                下载图片
              </Button>
              <Button className="flex-1" variant="outline" loading={loading} onClick={handleGenerate}>
                重新处理
              </Button>
              <Link href="/history" className="flex-1">
                <Button className="w-full" variant="secondary">
                  查看历史记录
                </Button>
              </Link>
            </div>
          ) : null}
        </Card>
      </div>
    </PageShell>
  );
}
