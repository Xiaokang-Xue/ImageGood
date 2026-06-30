"use client";

import { useRef, useState } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  ImageNormalizationError,
  isPotentialImageFile,
  prepareImageFileForUpload,
  shouldNormalizeImageFile
} from "@/lib/client-image-normalizer";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  value?: string | null;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
  onImageSelected: (imageUrl: string, file: File) => void;
}

export function UploadDropzone({
  value,
  title = "上传图片",
  subtitle = "支持点击或拖拽上传 PNG、JPG、WebP",
  compact = false,
  className,
  onImageSelected
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const readFile = async (file?: File) => {
    if (!file || !isPotentialImageFile(file)) {
      setUploadError("请选择图片文件");
      return;
    }

    const needsNormalization = shouldNormalizeImageFile(file);
    setIsProcessing(needsNormalization);
    setUploadError("");
    try {
      const uploadFile = await prepareImageFileForUpload(file);
      const previewUrl = URL.createObjectURL(uploadFile);
      onImageSelected(previewUrl, uploadFile);
    } catch (error) {
      setUploadError(
        error instanceof ImageNormalizationError
          ? error.message
          : "图片格式自动处理失败，请更换图片后再试"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-dashed transition duration-200",
        "bg-white hover:border-neutral-950 hover:bg-neutral-50",
        isDragging ? "border-neutral-950 bg-neutral-50" : "border-neutral-400",
        compact ? "min-h-[220px]" : "min-h-[320px]",
        className
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void readFile(event.dataTransfer.files[0]);
      }}
    >
      <button
        type="button"
        className="absolute inset-0 z-10 cursor-pointer disabled:cursor-wait"
        aria-label={title}
        disabled={isProcessing}
        onClick={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void readFile(event.target.files?.[0])}
      />

      {isProcessing ? (
        <div className="flex h-full min-h-[inherit] flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-950" />
          <p className="text-lg font-semibold text-ink">正在优化图片格式</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">仅在图片格式不兼容或超过 10MB 时自动转换</p>
        </div>
      ) : value ? (
        <SmartImage src={value} alt="上传预览" className="h-full min-h-[inherit] w-full rounded-none border-0" />
      ) : (
        <div className="flex h-full min-h-[inherit] flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-white shadow-sm">
            {compact ? <ImagePlus className="h-7 w-7" /> : <UploadCloud className="h-8 w-8" />}
          </div>
          <p className="text-lg font-semibold text-ink">{title}</p>
          {subtitle ? <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{subtitle}</p> : null}
          <div className="mt-5 hidden rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-500 sm:block">
            拖到这里即可开始
          </div>
        </div>
      )}

      {value ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 rounded-lg border border-neutral-200 bg-white/92 px-4 py-3 text-sm text-neutral-700 opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100">
          点击重新上传或拖拽替换图片
        </div>
      ) : null}

      {uploadError ? (
        <div className="absolute inset-x-4 bottom-4 z-20 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm">
          {uploadError}
        </div>
      ) : null}
    </div>
  );
}
