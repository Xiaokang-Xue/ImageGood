"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type SmartImageRatio = "auto" | "1:1" | "4:3" | "16:9" | "3:4" | "9:16";

const ratioClasses: Record<SmartImageRatio, string> = {
  auto: "",
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "16:9": "aspect-video",
  "3:4": "aspect-[3/4]",
  "9:16": "aspect-[9/16]"
};

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  ratio?: SmartImageRatio;
  rounded?: boolean;
  shadow?: boolean;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  previewWidth?: number | false;
  loadingLabel?: string;
}

const AUTO_RETRY_DELAYS = [350, 900, 1800];

function imageSourceForAttempt(src: string, attempt: number) {
  if (!attempt || !src.startsWith("/") || src.startsWith("//")) return src;

  const hashIndex = src.indexOf("#");
  const source = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : "";
  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}image_attempt=${attempt}${hash}`;
}

function imagePreviewSource(src: string, width: number | false) {
  if (
    !width ||
    (!src.startsWith("/api/storage/images/") && !src.startsWith("/api/task-images/"))
  ) {
    return src;
  }

  const hashIndex = src.indexOf("#");
  const source = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : "";
  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}image_preview=${Math.round(width)}${hash}`;
}

export function SmartImage({
  src,
  alt,
  className,
  imageClassName,
  ratio = "auto",
  rounded = true,
  shadow = false,
  priority = false,
  sizes,
  width = 1200,
  height = 900,
  previewWidth,
  loadingLabel
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [requestVersion, setRequestVersion] = useState(0);
  const [previewDisabled, setPreviewDisabled] = useState(false);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setFailed(false);
    setLoaded(false);
    setFailureCount(0);
    setRequestVersion(0);
    setPreviewDisabled(false);

    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, [src]);

  const effectivePreviewWidth = previewWidth === false ? false : previewWidth ?? (priority ? 1280 : 720);
  const previewSrc = imagePreviewSource(src, effectivePreviewWidth);
  const usingPreview = !previewDisabled && previewSrc !== src;

  const handleLoadError = () => {
    setLoaded(false);

    if (usingPreview) {
      setPreviewDisabled(true);
      setFailureCount(0);
      setRequestVersion((current) => current + 1);
      return;
    }

    if (failureCount >= AUTO_RETRY_DELAYS.length) {
      setFailed(true);
      return;
    }

    const delay = AUTO_RETRY_DELAYS[failureCount];
    setFailureCount((current) => current + 1);
    retryTimerRef.current = window.setTimeout(() => {
      setRequestVersion((current) => current + 1);
      retryTimerRef.current = null;
    }, delay);
  };

  const retryNow = () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setFailed(false);
    setLoaded(false);
    setFailureCount(0);
    setPreviewDisabled(false);
    setRequestVersion((current) => current + 1);
  };

  const resolvedSrc = imageSourceForAttempt(usingPreview ? previewSrc : src, requestVersion);

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-neutral-300 bg-neutral-100",
        rounded && "rounded-lg",
        shadow && "shadow-card",
        ratioClasses[ratio],
        className
      )}
      aria-busy={!failed && !loaded}
    >
      {failed ? (
        <div className="flex h-full min-h-[inherit] w-full flex-col items-center justify-center px-5 text-center text-slate-500">
          <ImageOff className="h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-600">{alt || "图片素材"}</p>
          <p className="mt-1 text-xs text-slate-400">图片暂时无法显示</p>
          <span
            role="button"
            tabIndex={0}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 hover:bg-neutral-50"
            onClick={(event) => {
              event.stopPropagation();
              retryNow();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                retryNow();
              }
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新加载
          </span>
        </div>
      ) : (
        <>
          {!loaded ? (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-neutral-200" aria-hidden="true">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-300" />
              {loadingLabel || priority ? (
                <span className="relative rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-semibold text-neutral-500 shadow-sm backdrop-blur-sm">
                  {loadingLabel || "正在加载预览…"}
                </span>
              ) : null}
            </div>
          ) : null}
          <img
            key={requestVersion}
            src={resolvedSrc}
            alt={alt}
            width={width}
            height={height}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
              imageClassName
            )}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            sizes={sizes}
            referrerPolicy="no-referrer"
            onLoad={(event) => {
              const image = event.currentTarget;
              const markLoaded = () => {
                setLoaded(true);
                setFailed(false);
              };
              if (typeof image.decode === "function") {
                image.decode().catch(() => undefined).finally(markLoaded);
              } else {
                markLoaded();
              }
            }}
            onError={handleLoadError}
          />
        </>
      )}
    </div>
  );
}
