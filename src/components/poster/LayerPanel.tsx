"use client";

import { Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PosterLayerKey, PosterLayerVisibility } from "@/types/image";

const layers: Array<{ key: PosterLayerKey; label: string; description: string }> = [
  { key: "title", label: "标题层", description: "主标题和封面标识" },
  { key: "subtitle", label: "副标题层", description: "补充说明文字" },
  { key: "decoration", label: "装饰元素", description: "网格、信息块和风格标识" },
  { key: "background", label: "背景图层", description: "AI 背景图和主色背景" }
];

interface LayerPanelProps {
  visibility: PosterLayerVisibility;
  onToggle: (key: PosterLayerKey) => void;
}

export function LayerPanel({ visibility, onToggle }: LayerPanelProps) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-studio-600">图层管理</p>
        <h2 className="mt-1 text-xl font-bold text-ink">控制画布元素</h2>
      </div>
      <div className="grid gap-2">
        {layers.map((layer) => (
          <button
            key={layer.key}
            type="button"
            className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
              visibility[layer.key]
                ? "border-line bg-white hover:border-studio-200 hover:bg-studio-50"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
            onClick={() => onToggle(layer.key)}
            aria-pressed={visibility[layer.key]}
          >
            <div className="flex items-center gap-2">
              {visibility[layer.key] ? (
                <Eye className="h-4 w-4 text-studio-600" />
              ) : (
                <EyeOff className="h-4 w-4 text-slate-400" />
              )}
              <span>
                <span className="block text-sm font-semibold text-slate-700">{layer.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{layer.description}</span>
              </span>
            </div>
            <span className="text-xs font-semibold text-muted">{visibility[layer.key] ? "显示" : "隐藏"}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
