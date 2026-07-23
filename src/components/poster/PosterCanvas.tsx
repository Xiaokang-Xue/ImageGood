"use client";

import { Badge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils";
import type { PosterLayerVisibility, PosterRatio, PosterStyle, PosterUsage } from "@/types/image";

const ratioClasses: Record<PosterRatio, string> = {
  "3:4": "aspect-[3/4]",
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "4:5": "aspect-[4/5]"
};

const titleSizeClasses: Record<PosterRatio, string> = {
  "3:4": "text-4xl",
  "1:1": "text-4xl",
  "16:9": "text-3xl md:text-4xl",
  "9:16": "text-3xl",
  "4:5": "text-4xl"
};

const usageCopy: Record<PosterUsage, string> = {
  xiaohongshu: "社媒封面",
  wechat: "公众号首图",
  community: "活动海报",
  course: "课程封面",
  checkin: "打卡计划"
};

const usageChips: Record<PosterUsage, string[]> = {
  xiaohongshu: ["封面标题", "内容亮点", "适合发布"],
  wechat: ["主题清晰", "阅读引导", "品牌感"],
  community: ["活动信息", "时间地点", "报名引导"],
  course: ["课程重点", "学习路径", "结果导向"],
  checkin: ["每日目标", "进度记录", "行动提示"]
};

const styleCopy: Record<PosterStyle, string> = {
  clean: "清爽现代",
  premium: "高级质感",
  cute: "轻快亲和",
  tech: "科技秩序",
  handdrawn: "手作灵感"
};

const styleDecoration: Record<PosterStyle, { label: string; index: string; align: "left" | "center" }> = {
  clean: { label: "Clean Layout", index: "01", align: "center" },
  premium: { label: "Premium Visual", index: "02", align: "left" },
  cute: { label: "Fresh Story", index: "03", align: "center" },
  tech: { label: "Digital Cover", index: "04", align: "left" },
  handdrawn: { label: "Creative Board", index: "05", align: "center" }
};

const defaultLayerVisibility: PosterLayerVisibility = {
  title: true,
  subtitle: true,
  decoration: true,
  background: true
};

interface PosterCanvasProps {
  title: string;
  subtitle: string;
  usage: PosterUsage;
  style: PosterStyle;
  ratio: PosterRatio;
  palette: string[];
  variantIndex: number;
  backgroundImage?: string;
  layers?: PosterLayerVisibility;
}

export function PosterCanvas({
  title,
  subtitle,
  usage,
  style,
  ratio,
  palette,
  variantIndex,
  backgroundImage,
  layers = defaultLayerVisibility
}: PosterCanvasProps) {
  const compact = ratio === "16:9";
  const tall = ratio === "3:4" || ratio === "4:5" || ratio === "9:16";
  const alignLeft = styleDecoration[style].align === "left" || variantIndex % 3 === 1;
  const showBackground = layers.background;
  const showDecoration = layers.decoration;
  const chips = usageChips[usage];

  return (
    <div className="flex min-h-[640px] items-center justify-center rounded-lg border border-line bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)] p-6">
      <div
        className={cn(
          "relative max-h-[600px] w-full max-w-[430px] overflow-hidden rounded-2xl border border-white/90 bg-white shadow-2xl shadow-slate-900/10",
          ratioClasses[ratio],
          ratio === "16:9" && "max-w-[720px]",
          ratio === "9:16" && "max-w-[340px]"
        )}
        style={{
          background: showBackground
            ? `linear-gradient(145deg, ${palette[0]} 0%, ${palette[1]} 52%, ${palette[2]} 100%)`
            : "#F8FAFC"
        }}
      >
        {backgroundImage && showBackground ? (
          <>
            <SmartImage
              src={backgroundImage}
              alt="海报背景"
              priority
              previewWidth={960}
              sizes="(min-width: 1024px) 720px, 100vw"
              loadingLabel="正在加载海报背景…"
              className="absolute inset-0 h-full w-full rounded-none border-0"
              imageClassName="object-cover"
              rounded={false}
            />
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0.58)_48%,rgba(15,23,42,0.08)_100%)]" />
          </>
        ) : null}

        {showDecoration ? (
          <>
            <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.58),transparent)]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.055)_1px,transparent_1px),linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[length:40px_40px]" />
            <div className="absolute left-6 top-6 h-24 w-1 rounded-full bg-slate-950/12" />
            <div className="absolute bottom-8 left-8 h-1 w-24 rounded-full bg-slate-950/12" />
            <div className="absolute right-0 top-0 h-full w-16 bg-white/26 backdrop-blur-[2px]" />
            <div className="absolute bottom-0 right-0 h-28 w-2/3 border-l border-t border-white/42 bg-white/24" />
            <div className="absolute right-7 top-7 rounded-lg border border-white/70 bg-white/68 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
              {styleCopy[style]}
            </div>
            <div className="absolute bottom-7 right-7 hidden rounded-lg border border-white/70 bg-white/64 px-3 py-2 text-xs font-semibold tracking-[0.22em] text-slate-500 backdrop-blur sm:block">
              {styleDecoration[style].index}
            </div>
          </>
        ) : null}

        <div
          className={cn(
            "relative z-10 flex h-full flex-col p-7 text-slate-950 md:p-8",
            compact ? "justify-center" : "justify-between",
            alignLeft ? "items-start text-left" : "items-center text-center"
          )}
        >
          <div className={cn("w-full", compact ? "max-w-[540px]" : "max-w-[92%]")}>
            {layers.title ? (
              <>
                <div className={cn("flex flex-wrap items-center gap-2", alignLeft ? "justify-start" : "justify-center")}>
                  <Badge variant="blue" className="bg-white/78 text-studio-700 ring-white/80">
                    {usageCopy[usage]}
                  </Badge>
                  {showDecoration ? (
                    <span className="rounded-full border border-white/68 bg-white/56 px-3 py-1 text-xs font-semibold text-slate-600 backdrop-blur">
                      {styleDecoration[style].label}
                    </span>
                  ) : null}
                </div>
                <h2
                  className={cn(
                    "mt-5 max-w-full break-words font-bold leading-[1.12] tracking-normal text-slate-950",
                    titleSizeClasses[ratio],
                    tall && "line-clamp-4",
                    compact && "max-w-[520px]"
                  )}
                >
                  {title || "输入封面标题"}
                </h2>
              </>
            ) : null}
            {layers.subtitle ? (
              <p
                className={cn(
                  layers.title ? "mt-4" : "mt-0",
                  "max-w-full break-words leading-7 text-slate-700",
                  compact ? "text-base" : "text-lg",
                  tall && "line-clamp-4"
                )}
              >
                {subtitle || "输入副标题，让信息更完整"}
              </p>
            ) : null}
          </div>

          {showDecoration ? (
            <div className={cn("mt-8 w-full", compact ? "max-w-[540px]" : alignLeft ? "max-w-[90%]" : "max-w-[82%]")}>
              <div className="rounded-xl border border-white/70 bg-white/58 p-4 shadow-lg shadow-slate-900/10 backdrop-blur">
                <div className="grid gap-3 sm:grid-cols-3">
                  {chips.map((item) => (
                    <div key={item} className="rounded-lg border border-white/70 bg-white/82 px-3 py-3 text-xs font-semibold text-slate-600">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="h-2 flex-1 rounded-full bg-slate-950/12" />
                  <span className="h-2 w-16 rounded-full bg-slate-950/8" />
                  <span className="h-2 w-8 rounded-full bg-slate-950/8" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
