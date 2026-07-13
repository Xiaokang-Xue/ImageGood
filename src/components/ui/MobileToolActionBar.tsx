"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface MobileToolActionBarProps {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  mode?: "generate" | "back";
  disabled?: boolean;
  helper?: string;
  onClick: () => void;
}

export function MobileToolActionBar({
  label,
  loading = false,
  loadingLabel = "图片生成中",
  mode = "generate",
  disabled = false,
  helper = "成功后消耗 1 积分，失败不扣积分",
  onClick
}: MobileToolActionBarProps) {
  return (
    <>
      <div className="h-24 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 pt-3 shadow-[0_-12px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden">
        <div
          className="mx-auto flex max-w-lg items-center gap-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <p className="min-w-0 flex-1 text-xs font-medium leading-5 text-neutral-500">{helper}</p>
          <Button
            className="min-w-[148px] shrink-0"
            variant="dark"
            loading={loading}
            disabled={disabled}
            onClick={onClick}
          >
            {!loading ? mode === "back" ? <ArrowLeft className="h-4 w-4" /> : <Sparkles className="h-4 w-4" /> : null}
            {loading ? loadingLabel : label}
          </Button>
        </div>
      </div>
    </>
  );
}
