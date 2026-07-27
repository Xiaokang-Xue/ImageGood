"use client";

import { cn } from "@/lib/utils";
import type { InputSuggestion } from "@/lib/input-assist";

interface InputAssistProps {
  title?: string;
  items: InputSuggestion[];
  mode?: "chips" | "cards";
  onSelect: (item: InputSuggestion) => void;
  className?: string;
}

export function InputAssist({
  title = "快捷提示",
  items,
  mode = "chips",
  onSelect,
  className
}: InputAssistProps) {
  return (
    <div className={cn("mt-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-neutral-600">{title}</p>
        <p className="text-[11px] text-neutral-400">点击使用，仍可继续修改</p>
      </div>
      <div className={cn("mt-2", mode === "cards" ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2")}>
        {items.map((item) => (
          <button
            key={`${item.label}-${item.value}`}
            type="button"
            className={cn(
              "border border-neutral-300 bg-white text-left text-neutral-700 transition hover:border-neutral-500 hover:bg-neutral-50 active:bg-neutral-100",
              mode === "cards" ? "rounded-lg px-3 py-2.5" : "rounded-full px-3 py-1.5 text-xs font-medium"
            )}
            onClick={() => onSelect(item)}
          >
            <span className={cn("block", mode === "cards" && "text-sm font-semibold text-neutral-900")}>{item.label}</span>
            {mode === "cards" && item.description ? (
              <span className="mt-1 block text-xs leading-5 text-neutral-500">{item.description}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
