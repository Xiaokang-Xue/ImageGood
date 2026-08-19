import type { Metadata } from "next";
import { Suspense } from "react";
import { BatchGenerationStudio } from "@/components/batch/BatchGenerationStudio";

export const metadata: Metadata = {
  title: "批量生成 - ImageGood",
  description: "使用同一份或逐项输入批量完成图片处理与文生图，每批支持 1、2 或 4 张。"
};

export default function BatchGenerationPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] bg-white" />}>
      <BatchGenerationStudio />
    </Suspense>
  );
}
