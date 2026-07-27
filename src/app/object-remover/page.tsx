import type { Metadata } from "next";
import { SingleImageEditToolStudio } from "@/components/tools/SingleImageEditToolStudio";
import { objectRemovalSuggestions } from "@/lib/input-assist";

export const metadata: Metadata = {
  title: "去杂物 - ImageGood",
  description: "上传图片并描述需要移除的路人、杂物、水印或干扰元素，AI 会尝试自然补全背景。"
};

export default function ObjectRemoverPage() {
  return (
    <SingleImageEditToolStudio
      endpoint="/api/images/object-remove"
      loginRedirect="/object-remover"
      eyebrow="去杂物"
      title="去除路人、杂物和多余元素"
      subtitle="先用文字描述要移除的对象，系统会清理画面并自然补全背景，适合日常修图和商品图清理。"
      buttonLabel="开始处理"
      processingTitle="正在清理画面，请稍候"
      emptyResultTitle="处理结果将在这里展示"
      emptyResultDescription="上传图片并描述需要移除的对象后，即可查看 AI 处理结果。"
      resultAlt="去杂物处理结果"
      downloadName="imagegood-object-removed.png"
      taskType="object-remove"
      promptLabel="需要移除什么？"
      promptPlaceholder="例如：去掉背景里的路人、去掉桌上的杂物、去掉右下角水印"
      promptRequired
      promptSuggestions={objectRemovalSuggestions}
      relatedTools={[
        { label: "图片增强", href: "/image-enhancer" },
        { label: "AI 修图", href: "/editor" },
        { label: "智能抠图", href: "/remove-background" }
      ]}
    />
  );
}
