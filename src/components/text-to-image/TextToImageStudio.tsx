"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, History, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  apiClient,
  downloadImage,
  getImageErrorMessage,
  ImageApiClientError,
  isContactNotVerifiedError,
  isInsufficientCreditsError,
  isUnauthorizedError
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { TextToImageStyle } from "@/types/image";

const styleOptions: Array<{ value: TextToImageStyle; label: string; description: string }> = [
  { value: "realistic", label: "写实", description: "真实摄影质感" },
  { value: "product", label: "商品图", description: "商业摄影光线" },
  { value: "poster", label: "海报", description: "适合封面视觉" },
  { value: "illustration", label: "插画", description: "细腻设计感" },
  { value: "minimal", label: "极简", description: "干净留白" }
];

const promptExamples = [
  "一张干净高级的咖啡杯商品图，浅色背景，自然光，适合电商主图",
  "城市夜景中的年轻人头像，写实摄影风格，柔和霓虹光",
  "夏季课程活动海报背景，清爽蓝白配色，预留标题区域",
  "一间极简风书房，阳光从窗边照进来，安静温暖"
];

async function createTextToImageTask(input: {
  prompt: string;
  style: TextToImageStyle;
  size: string;
  quality: string;
  outputFormat: string;
}) {
  const response = await fetch("/api/images/text-to-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = (await response.json().catch(() => null)) as
    | { taskId?: string }
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    throw new ImageApiClientError(error?.code || "REQUEST_FAILED", error?.message || `请求失败：${response.status}`);
  }

  if (!payload || !("taskId" in payload) || !payload.taskId) {
    throw new ImageApiClientError("TASK_CREATE_FAILED", "创建文生图任务失败，请稍后重试");
  }

  return { taskId: payload.taskId };
}

export function TextToImageStudio() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<TextToImageStyle>("realistic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorActionHref, setErrorActionHref] = useState("");
  const [taskId, setTaskId] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const handleGenerate = async () => {
    const finalPrompt = prompt.trim();
    if (finalPrompt.length < 4) {
      setError("请先输入想生成的图片描述");
      setErrorActionHref("");
      return;
    }

    setLoading(true);
    setError("");
    setErrorActionHref("");
    setResultUrl("");
    setTaskId("");

    try {
      const response = await createTextToImageTask({
        prompt: finalPrompt,
        style,
        size: "1024x1024",
        quality: "auto",
        outputFormat: "png"
      });
      setTaskId(response.taskId);

      const task = await apiClient.waitForTaskDone(response.taskId);
      if (task.status === "failed") {
        throw new Error(task.errorMessage || "图片生成失败，请稍后重试");
      }

      const url = task.resultImages?.[0] || task.resultImageUrl;
      if (!url) {
        throw new Error("生成完成但未检测到结果图片");
      }

      setResultUrl(url);
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.push("/login?redirect=/text-to-image");
        return;
      }
      setErrorActionHref(
        isInsufficientCreditsError(requestError) ? "/pricing" : isContactNotVerifiedError(requestError) ? "/account" : ""
      );
      setError(getImageErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">文生图</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">输入一句描述，生成高质量图片</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            适合头像、商品图、封面背景、场景图和创意图片。每次成功生成消耗 1 个积分，失败不扣积分。
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

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-button-gradient text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">描述你的画面</h2>
              <p className="mt-1 text-sm text-muted">越具体，画面越稳定。</p>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：一张高级感的白色运动鞋商品图，柔和棚拍光，浅灰背景，主体居中，细节清晰"
            className="min-h-[180px] w-full resize-none rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
          />

          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">选择风格</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
              {styleOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition",
                    style === item.value
                      ? "border-studio-300 bg-studio-50 text-studio-700"
                      : "border-line bg-white text-slate-600 hover:border-studio-200 hover:bg-studio-50/60"
                  )}
                  onClick={() => setStyle(item.value)}
                >
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="mt-1 block text-xs">{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">提示示例</p>
            <div className="grid gap-2">
              {promptExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-left text-xs leading-5 text-slate-600 transition hover:border-studio-200 hover:bg-studio-50"
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <Button className="mt-6 w-full" size="lg" loading={loading} onClick={handleGenerate}>
            生成图片
          </Button>
        </Card>

        <Card className="overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-studio-600">生成结果</p>
              <h2 className="mt-1 text-xl font-bold text-ink">结果将在这里展示</h2>
            </div>
            {loading && taskId ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">任务处理中</span>
            ) : null}
          </div>

          <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-line bg-slate-50 p-4">
            {loading ? (
              <div className="text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-studio-600" />
                <p className="mt-4 text-lg font-bold text-ink">图片生成中，请稍候</p>
                <p className="mt-2 text-sm text-muted">生成时间可能较长，请不要关闭页面。</p>
              </div>
            ) : resultUrl ? (
              <SmartImage
                src={resultUrl}
                alt="文生图生成结果"
                className="h-[640px] max-h-[70vh] w-full rounded-lg border-line bg-white"
                imageClassName="object-contain"
              />
            ) : (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white text-studio-600 shadow-sm ring-1 ring-line">
                  <ImagePlus className="h-7 w-7" />
                </div>
                <p className="mt-4 text-lg font-bold text-ink">生成结果将在这里展示</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">输入图片描述并选择风格后，即可查看 AI 生成结果。</p>
              </div>
            )}
          </div>

          {resultUrl ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1" variant="dark" onClick={() => downloadImage(resultUrl, `imagegood-text-to-image-${Date.now()}.png`)}>
                <Download className="h-4 w-4" />
                下载图片
              </Button>
              <Button className="flex-1" variant="outline" onClick={handleGenerate} loading={loading}>
                再次生成
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
