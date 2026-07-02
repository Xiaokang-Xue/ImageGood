"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { BeforeAfter } from "@/components/editor/BeforeAfter";
import { HistoryTimeline } from "@/components/editor/HistoryTimeline";
import { PromptPanel } from "@/components/editor/PromptPanel";
import { ResultGallery } from "@/components/editor/ResultGallery";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";
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
import { toolPrompts } from "@/lib/studio-content";
import { useStudioStore } from "@/lib/studio-store";
import type { EditImageResult, EditTool, HistoryItem } from "@/types/image";

const steps = ["上传图片", "描述需求", "生成结果", "继续修改"];
const editableTools: EditTool[] = ["background", "remove", "enhance", "style", "expand", "custom"];

interface EditorWorkspaceProps {
  initialTool?: string;
}

export function EditorWorkspace({ initialTool }: EditorWorkspaceProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pollingController = useRef<AbortController | null>(null);
  const {
    uploadedImage,
    uploadedImageFile,
    currentImage,
    currentImageFile,
    prompt,
    selectedTool,
    editResults,
    selectedResult,
    history,
    setUploadedImage,
    setCurrentImage,
    setPrompt,
    setSelectedTool,
    setEditResults,
    setSelectedResult,
    addHistoryItem
  } = useStudioStore();

  useEffect(() => {
    return () => pollingController.current?.abort();
  }, []);

  useEffect(() => {
    if (!initialTool || !editableTools.includes(initialTool as EditTool)) return;
    const tool = initialTool as EditTool;
    setSelectedTool(tool);
    setPrompt(toolPrompts[tool]);
  }, [initialTool, setPrompt, setSelectedTool]);

  const originalImage = uploadedImage;
  const inputPreview = currentImage ?? originalImage;
  const visibleResults = editResults;
  const currentVersion = selectedResult?.url ?? visibleResults[0]?.url ?? currentImage ?? null;

  const activeStep = useMemo(() => {
    if (editResults.length > 0) return 3;
    if (prompt) return 2;
    if (uploadedImage) return 1;
    return 0;
  }, [editResults.length, prompt, uploadedImage]);

  const handleGenerate = async () => {
    const finalPrompt = prompt.trim() || toolPrompts[selectedTool] || "提升图片整体质感，画面更干净自然";
    const finalTool: EditTool = selectedTool || "custom";

    if (!currentImageFile && !uploadedImageFile && !currentImage && !uploadedImage) {
      setError("请先上传需要处理的图片");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    pollingController.current?.abort();
    const controller = new AbortController();
    pollingController.current = controller;
    try {
      const shouldUseCurrentImageUrl = Boolean(currentImage && currentImage !== uploadedImage && !currentImageFile);
      const selectedInputFile = shouldUseCurrentImageUrl ? null : currentImageFile ?? uploadedImageFile ?? null;
      const selectedInputUrl = currentImage ?? originalImage ?? undefined;

      const submitEdit = async (imageOverride?: File) => {
        const response = await apiClient.editImage({
          image: imageOverride ?? selectedInputFile ?? undefined,
          imageUrl: imageOverride ? undefined : currentImage ?? originalImage ?? undefined,
          prompt: finalPrompt,
          tool: finalTool,
          size: "1024x1024",
          quality: "auto",
          outputFormat: "png"
        });

        let result = response.results?.[0] as EditImageResult | undefined;
        let historyItem = response.historyItem as HistoryItem | undefined;

        if (!result) {
          const task = await apiClient.waitForTaskDone(response.taskId, { signal: controller.signal });
          if (task.status === "failed") {
            throw new Error(task.errorMessage || "生成失败，请稍后重试");
          }

          const url = task.resultImages?.[0] || task.resultImageUrl;
          if (!url) {
            throw new Error("生成完成但未检测到结果图片");
          }

          result = {
            id: "result-1",
            url,
            type: "edited",
            label: "生成结果"
          };
          historyItem = {
            id: task.id,
            title: "生成结果",
            createdAt: task.createdAt,
            thumbnail: url
          };
        }

        return { response, result, historyItem };
      };

      let generation: Awaited<ReturnType<typeof submitEdit>>;
      try {
        generation = await submitEdit();
      } catch (firstError) {
        if (!isImageCompatibilityError(firstError)) {
          throw firstError;
        }

        const retrySourceFile =
          selectedInputFile ?? (selectedInputUrl ? await imageUrlToUploadFile(selectedInputUrl, "edit-input") : null);
        if (!retrySourceFile) {
          throw firstError;
        }

        setNotice("系统已自动优化图片格式，正在重新生成。");
        const normalizedFile = await forceNormalizeImageFileForUpload(retrySourceFile);
        generation = await submitEdit(normalizedFile);
      }

      const { response, result } = generation;
      let { historyItem } = generation;

      if (!historyItem) {
        historyItem = {
          id: response.taskId,
          title: "生成结果",
          createdAt: new Date().toISOString(),
          thumbnail: result.url
        };
      }

      setEditResults([result]);
      setSelectedResult(result);
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
      addHistoryItem(historyItem);
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      if (isUnauthorizedError(requestError)) {
        router.push("/login?redirect=/editor");
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

  const handleContinueEdit = (result: EditImageResult) => {
    setSelectedResult(result);
    setCurrentImage(result.url, null);
    setSelectedTool("custom");
    setPrompt("");
    setError("");
    setNotice("已将生成结果设为下一次修改的输入图，请在右侧输入新的修改需求。");
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">AI 修图工作台</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">上传图片，描述需求，拿到可继续修改的结果</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${
                index <= activeStep ? "bg-studio-100 text-studio-700" : "bg-white text-slate-500 ring-1 ring-line"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {step}
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {error.includes("登录") ? (
            <Link href="/login?redirect=/editor" className="text-studio-700 underline">
              去登录
            </Link>
          ) : error.includes("积分不足") ? (
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

      {notice ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{notice}</span>
          <button type="button" className="text-studio-700 underline" onClick={() => setNotice("")}>
            知道了
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mb-6 rounded-lg border border-studio-200 bg-studio-50 px-4 py-3 text-sm font-semibold text-studio-700">
          图片生成中，可能需要较长时间，请不要关闭页面。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <Card className="p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-studio-600">当前输入图</p>
            <h2 className="mt-1 text-xl font-bold text-ink">
              {inputPreview && inputPreview !== originalImage ? "继续修改素材" : "输入素材"}
            </h2>
          </div>
          <UploadDropzone
            value={inputPreview}
            compact
            title="上传原图"
            subtitle="拖拽或点击替换当前图片；继续修改时会使用生成结果作为输入"
            className="min-h-[360px]"
            onImageSelected={(imageUrl, file) => setUploadedImage(imageUrl, file)}
          />
        </Card>

        <div className="grid gap-6">
          <ResultGallery
            results={visibleResults}
            selectedId={selectedResult?.id}
            loading={loading}
            error={error}
            onSelect={(result) => setSelectedResult(result)}
            onContinueEdit={handleContinueEdit}
            onRetry={handleGenerate}
          />
          <BeforeAfter before={originalImage} after={currentVersion} />
        </div>

        <PromptPanel
          prompt={prompt}
          selectedTool={selectedTool}
          loading={loading}
          onPromptChange={setPrompt}
          onToolChange={setSelectedTool}
          onGenerate={handleGenerate}
        />
      </div>

      <div className="mt-6">
        <HistoryTimeline items={history} />
      </div>
    </PageShell>
  );
}
