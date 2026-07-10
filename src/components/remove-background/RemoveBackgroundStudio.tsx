"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, Eraser, History, Palette, UploadCloud } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GenerationErrorPanel, GenerationLoadingPanel } from "@/components/ui/GenerationLoadingPanel";
import { SmartImage } from "@/components/ui/SmartImage";
import { UploadDropzone } from "@/components/ui/UploadDropzone";
import {
  apiClient,
  downloadImage,
  getImageErrorMessage,
  imageUrlToUploadFile,
  ImageApiClientError,
  isAbortError,
  isContactNotVerifiedError,
  isInsufficientCreditsError,
  isPaymentSourceSurveyRequiredError,
  isUnauthorizedError
} from "@/lib/api-client";

const transparentPreviewStyle = {
  backgroundImage:
    "linear-gradient(45deg, #eef2ff 25%, transparent 25%), linear-gradient(-45deg, #eef2ff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef2ff 75%), linear-gradient(-45deg, transparent 75%, #eef2ff 75%)",
  backgroundSize: "24px 24px",
  backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0"
};

const backgroundOptions = [
  { value: "transparent", label: "透明" },
  { value: "white", label: "白底" },
  { value: "black", label: "黑底" },
  { value: "custom", label: "自定义" }
] as const;

type BackgroundMode = (typeof backgroundOptions)[number]["value"];

async function createRemoveBackgroundTask(input: {
  image?: File | null;
  imageUrl?: string;
  size: string;
  quality: string;
}) {
  const image = input.image ?? (input.imageUrl ? await imageUrlToUploadFile(input.imageUrl, "remove-bg-input") : null);
  const formData = new FormData();

  if (image) {
    formData.append("image", image);
  }
  formData.append("size", input.size);
  formData.append("quality", input.quality);

  const response = await fetch("/api/images/remove-background", {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as
    | { taskId?: string }
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    throw new ImageApiClientError(error?.code || "REQUEST_FAILED", error?.message || `请求失败：${response.status}`, {
      actionUrl: error && "actionUrl" in error ? String(error.actionUrl || "") : undefined,
      orderId: error && "orderId" in error ? String(error.orderId || "") : undefined
    });
  }

  if (!payload || !("taskId" in payload) || !payload.taskId) {
    throw new ImageApiClientError("TASK_CREATE_FAILED", "创建抠图任务失败，请稍后重试");
  }

  return { taskId: payload.taskId };
}

export function RemoveBackgroundStudio() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorActionHref, setErrorActionHref] = useState("");
  const [taskId, setTaskId] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("transparent");
  const [customBackground, setCustomBackground] = useState("#f8fafc");
  const [downloadingBackground, setDownloadingBackground] = useState(false);
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
    if (!imageFile && !imageUrl) {
      setError("请先上传需要抠图的图片");
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
      const response = await createRemoveBackgroundTask({
        image: imageFile ?? undefined,
        imageUrl: imageFile ? undefined : imageUrl,
        size: "1024x1024",
        quality: "auto"
      });
      setTaskId(response.taskId);

      const task = await apiClient.waitForTaskDone(response.taskId, { signal: controller.signal });
      if (task.status === "failed") {
        throw new Error(task.errorMessage || "抠图失败，请稍后重试");
      }

      const url = task.resultImages?.[0] || task.resultImageUrl;
      if (!url) {
        throw new Error("抠图完成但未检测到结果图片");
      }

      setResultUrl(url);
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      if (isUnauthorizedError(requestError)) {
        router.push("/login?redirect=/remove-background");
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

  const previewStyle =
    backgroundMode === "transparent"
      ? transparentPreviewStyle
      : {
          backgroundColor:
            backgroundMode === "white" ? "#ffffff" : backgroundMode === "black" ? "#111827" : customBackground
        };

  const selectedBackgroundColor =
    backgroundMode === "black" ? "#111827" : backgroundMode === "custom" ? customBackground : "#ffffff";

  const downloadWithBackground = async () => {
    if (!resultUrl) return;

    setDownloadingBackground(true);
    setError("");
    try {
      const response = await fetch(resultUrl);
      if (!response.ok) {
        throw new Error("无法读取抠图结果，请稍后重试");
      }

      const blob = await response.blob();
      const image = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error("当前浏览器无法合成背景图片");
      }

      context.fillStyle = selectedBackgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      image.close();

      const outputBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("背景图片导出失败"))), "image/png");
      });
      const objectUrl = URL.createObjectURL(outputBlob);
      await downloadImage(objectUrl, "imagegood-remove-bg-with-background.png");
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "背景图片下载失败，请稍后重试");
    } finally {
      setDownloadingBackground(false);
    }
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">智能抠图</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">上传图片，一键去除背景</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            自动保留主体边缘细节，优先输出透明背景 PNG，适合商品图、头像和设计素材。
          </p>
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
              <Eraser className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">上传需要抠图的图片</h2>
              <p className="mt-1 text-sm text-muted">每次成功抠图消耗 1 个积分。</p>
            </div>
          </div>

          <UploadDropzone
            value={imageUrl}
            title="上传图片"
            subtitle="支持手机照片和常见图片格式，系统会自动处理不兼容格式"
            className="min-h-[420px]"
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

          <Button className="mt-6 w-full" size="lg" loading={loading} onClick={handleGenerate}>
            开始抠图
          </Button>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-studio-600">原图</p>
              <h2 className="mt-1 text-xl font-bold text-ink">输入素材</h2>
            </div>
            <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-line bg-slate-50 p-4">
              {imageUrl ? (
                <SmartImage
                  src={imageUrl}
                  alt="抠图原图"
                  className="h-[560px] max-h-[68vh] w-full rounded-lg border-line bg-white"
                  imageClassName="object-contain"
                />
              ) : (
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white text-studio-600 shadow-sm ring-1 ring-line">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <p className="mt-4 text-lg font-bold text-ink">原图将在这里展示</p>
                  <p className="mt-2 text-sm text-muted">上传图片后即可开始抠图。</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-studio-600">抠图结果</p>
                <h2 className="mt-1 text-xl font-bold text-ink">透明 PNG 与背景预览</h2>
              </div>
              {loading && taskId ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">任务处理中</span>
              ) : null}
            </div>

            {resultUrl ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {backgroundOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      backgroundMode === item.value
                        ? "border-studio-300 bg-studio-50 text-studio-700"
                        : "border-line bg-white text-slate-600 hover:border-studio-200 hover:bg-studio-50"
                    }`}
                    onClick={() => setBackgroundMode(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
                {backgroundMode === "custom" ? (
                  <label className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-600">
                    <Palette className="h-4 w-4" />
                    <input
                      type="color"
                      value={customBackground}
                      className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                      onChange={(event) => setCustomBackground(event.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-line bg-white p-4" style={previewStyle}>
              {loading ? (
                <GenerationLoadingPanel
                  taskType="remove-background"
                  taskId={taskId}
                  minHeightClassName="min-h-[500px]"
                  className="w-full"
                />
              ) : error ? (
                <GenerationErrorPanel message={error} onRetry={handleGenerate} minHeightClassName="min-h-[500px]" className="w-full" />
              ) : resultUrl ? (
                <SmartImage
                  src={resultUrl}
                  alt="智能抠图结果"
                  className="h-[560px] max-h-[68vh] w-full rounded-lg border-line bg-white/70"
                  imageClassName="object-contain"
                />
              ) : (
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white text-studio-600 shadow-sm ring-1 ring-line">
                    <Eraser className="h-7 w-7" />
                  </div>
                  <p className="mt-4 text-lg font-bold text-ink">抠图结果将在这里展示</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted">上传图片并点击开始抠图后，即可下载透明背景图片。</p>
                </div>
              )}
            </div>

            {resultUrl ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Button className="flex-1" variant="dark" onClick={() => downloadImage(resultUrl, "imagegood-remove-bg.png")}>
                  <Download className="h-4 w-4" />
                  透明 PNG
                </Button>
                <Button className="flex-1" variant="outline" loading={downloadingBackground} onClick={downloadWithBackground}>
                  <Download className="h-4 w-4" />
                  带背景图片
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
      </div>
    </PageShell>
  );
}
