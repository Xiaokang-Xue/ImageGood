"use client";

import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type CreditPurchasePromptVariant = "experience-complete" | "insufficient";

interface CreditPurchasePromptProps {
  variant: CreditPurchasePromptVariant;
}

const content: Record<CreditPurchasePromptVariant, { title: string; description: string }> = {
  "experience-complete": {
    title: "作品已生成，当前积分已用完",
    description: "作品已经保存。补充积分后可以继续修改或使用其他图片工具，支付成功后自动到账。"
  },
  insufficient: {
    title: "积分不足，暂时无法继续生成",
    description: "选择合适的积分包后即可返回当前工作台继续创作。"
  }
};

export function CreditPurchasePrompt({ variant }: CreditPurchasePromptProps) {
  const copy = content[variant];

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-800">
          <Coins className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950">{copy.title}</p>
          <p className="mt-1 text-sm leading-6 text-neutral-600">{copy.description}</p>
        </div>
      </div>
      <Link href="/pricing" className="shrink-0">
        <Button className="w-full sm:w-auto" variant="dark" size="sm">
          查看积分套餐
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
