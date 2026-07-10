import type { Metadata } from "next";
import { SingleImageEditToolStudio } from "@/components/tools/SingleImageEditToolStudio";

export const metadata: Metadata = {
  title: "图片增强 - ImageGood",
  description: "上传低清图片，一键提升清晰度、细节质感和整体观感，生成结果可下载并保存到历史记录。"
};

export default function ImageEnhancerPage() {
  return (
    <SingleImageEditToolStudio
      endpoint="/api/images/enhance"
      loginRedirect="/image-enhancer"
      eyebrow="图片增强"
      title="上传低清图片，一键提升细节质感"
      subtitle="适合老照片、商品图、截图和社媒配图。系统会尽量保持原图内容不变，只增强清晰度、光影和细节。"
      uploadTitle="上传需要增强的图片"
      uploadSubtitle="支持手机照片和常见图片格式，系统会自动处理不兼容格式"
      buttonLabel="开始增强"
      processingTitle="图片增强中，请稍候"
      emptyResultTitle="增强结果将在这里展示"
      emptyResultDescription="上传图片后点击开始增强，即可查看处理结果。"
      resultAlt="图片增强结果"
      downloadName="imagegood-enhanced.png"
      taskType="image-enhance"
      relatedTools={[
        { label: "去杂物", href: "/object-remover" },
        { label: "AI 修图", href: "/editor" },
        { label: "智能抠图", href: "/remove-background" }
      ]}
    />
  );
}
