"use client";

import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { posterStyleLabels } from "@/lib/studio-content";
import { cn } from "@/lib/utils";
import type { PosterRatio, PosterStyle } from "@/types/image";

const styles: PosterStyle[] = ["clean", "premium", "cute", "tech", "handdrawn"];
const ratios: PosterRatio[] = ["3:4", "1:1", "16:9", "9:16", "4:5"];
const palettes = [
  ["#EAF4FF", "#FFFFFF", "#C9DDFF"],
  ["#F4F0FF", "#FFFFFF", "#D8CCFF"],
  ["#ECFEFF", "#FFFFFF", "#B6F0E6"],
  ["#FFF7ED", "#FFFFFF", "#FAD7A4"]
];

interface PosterSettingsProps {
  title: string;
  subtitle: string;
  style: PosterStyle;
  ratio: PosterRatio;
  paletteIndex: number;
  loading?: boolean;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onStyleChange: (value: PosterStyle) => void;
  onRatioChange: (value: PosterRatio) => void;
  onPaletteChange: (value: number) => void;
  onGenerate: () => void;
}

export { palettes };

export function PosterSettings({
  title,
  subtitle,
  style,
  ratio,
  paletteIndex,
  loading,
  onTitleChange,
  onSubtitleChange,
  onStyleChange,
  onRatioChange,
  onPaletteChange,
  onGenerate
}: PosterSettingsProps) {
  return (
    <Card className="p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-studio-600">文字和风格设置</p>
        <h2 className="mt-1 text-xl font-bold text-ink">实时调整画布</h2>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">标题</span>
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="输入封面标题"
          className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-slate-700">副标题</span>
        <textarea
          value={subtitle}
          onChange={(event) => onSubtitleChange(event.target.value)}
          rows={3}
          placeholder="输入补充说明"
          className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
        />
      </label>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-700">风格选择</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {styles.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                style === item
                  ? "border-studio-500 bg-studio-50 text-studio-700"
                  : "border-line bg-white text-slate-600 hover:border-studio-200"
              )}
              onClick={() => onStyleChange(item)}
            >
              {posterStyleLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-700">配色方案</p>
        <div className="mt-3 flex gap-2">
          {palettes.map((palette, index) => (
            <button
              key={palette.join("-")}
              type="button"
              className={cn(
                "flex h-9 w-16 overflow-hidden rounded-lg border p-1 transition",
                paletteIndex === index ? "border-studio-500 ring-4 ring-studio-500/10" : "border-line"
              )}
              onClick={() => onPaletteChange(index)}
              aria-label={`配色方案 ${index + 1}`}
            >
              {palette.map((color) => (
                <span key={color} className="h-full flex-1 first:rounded-l-md last:rounded-r-md" style={{ background: color }} />
              ))}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-700">尺寸比例</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {ratios.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "rounded-lg border px-2 py-2 text-sm font-semibold transition",
                ratio === item
                  ? "border-studio-500 bg-studio-50 text-studio-700"
                  : "border-line bg-white text-slate-600 hover:border-studio-200"
              )}
              onClick={() => onRatioChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <Button className="mt-6 hidden w-full md:inline-flex" size="lg" loading={loading} onClick={onGenerate}>
        {!loading ? <WandSparkles className="h-4 w-4" /> : null}
        {loading ? "生成中..." : "AI 生成封面"}
      </Button>
    </Card>
  );
}
