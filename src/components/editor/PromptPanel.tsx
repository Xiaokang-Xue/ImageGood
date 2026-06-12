"use client";

import { Expand, Eraser, Image, Send, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toolLabels, toolPrompts } from "@/lib/studio-content";
import { cn } from "@/lib/utils";
import type { EditTool } from "@/types/image";

const tools: Array<{ key: EditTool; icon: typeof Image }> = [
  { key: "background", icon: Image },
  { key: "remove", icon: Eraser },
  { key: "enhance", icon: Sparkles },
  { key: "style", icon: Wand2 },
  { key: "expand", icon: Expand }
];

interface PromptPanelProps {
  prompt: string;
  selectedTool: EditTool;
  loading?: boolean;
  onPromptChange: (value: string) => void;
  onToolChange: (tool: EditTool) => void;
  onGenerate: () => void;
}

export function PromptPanel({
  prompt,
  selectedTool,
  loading,
  onPromptChange,
  onToolChange,
  onGenerate
}: PromptPanelProps) {
  return (
    <Card className="sticky top-24 p-5">
      <div>
        <p className="text-sm font-semibold text-studio-600">控制面板</p>
        <h2 className="mt-1 text-xl font-bold text-ink">描述你想怎么修改图片</h2>
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-slate-700">编辑需求</span>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={6}
          placeholder="例如：把背景换成干净的白色摄影棚，主体保持不变"
          className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-slate-400 focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
        />
      </label>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-700">快捷工具</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const active = selectedTool === tool.key;
            return (
              <button
                key={tool.key}
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition",
                  active
                    ? "border-studio-500 bg-studio-50 text-studio-700 shadow-sm"
                    : "border-line bg-white text-slate-700 hover:border-studio-200 hover:bg-studio-50"
                )}
                onClick={() => {
                  if (active) {
                    onToolChange("custom");
                    if (prompt === toolPrompts[tool.key]) {
                      onPromptChange("");
                    }
                    return;
                  }
                  onToolChange(tool.key);
                  onPromptChange(toolPrompts[tool.key]);
                }}
              >
                <Icon className="h-4 w-4" />
                {toolLabels[tool.key]}
              </button>
            );
          })}
        </div>
      </div>

      <Button className="mt-6 w-full" size="lg" loading={loading} onClick={onGenerate}>
        {loading ? "生成中..." : "生成结果"}
        {!loading ? <Send className="h-4 w-4" /> : null}
      </Button>

      <p className="mt-4 text-xs leading-5 text-muted">
        生成任务会在服务端处理，完成后自动保存到历史记录。
      </p>
    </Card>
  );
}
