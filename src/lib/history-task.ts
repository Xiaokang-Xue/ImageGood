import type { EditTool } from "@/types/image";
import type { ImageTaskRecord, ImageTaskStatus, ImageTaskType } from "@/types/task";

export const historyTaskTypeLabels: Record<ImageTaskType, string> = {
  edit: "AI 修图",
  product: "商品图",
  poster: "封面海报",
  text_to_image: "文生图",
  remove_background: "智能抠图",
  image_enhance: "图片增强",
  object_remove: "去杂物"
};

export const historyTaskStatusLabels: Record<ImageTaskStatus, string> = {
  pending: "等待处理",
  processing: "生成中",
  succeeded: "已完成",
  failed: "生成失败"
};

export const historyTaskRoutes: Record<ImageTaskType, string> = {
  edit: "/editor",
  product: "/product",
  poster: "/poster",
  text_to_image: "/text-to-image",
  remove_background: "/remove-background",
  image_enhance: "/image-enhancer",
  object_remove: "/object-remover"
};

const editorTools = new Set<EditTool>(["background", "remove", "enhance", "style", "expand", "custom"]);

export const HISTORY_TEXT_PROMPT_KEY = "imagegood:history:text-to-image-prompt";

export function getHistoryTaskTitle(task: ImageTaskRecord) {
  return task.title?.trim() || historyTaskTypeLabels[task.type];
}

export function getHistoryTaskResult(task: ImageTaskRecord) {
  return task.resultImages?.[0] || task.resultImageUrl || "";
}

export function getHistoryTaskEditorTool(task: ImageTaskRecord): EditTool {
  return task.type === "edit" && task.tool && editorTools.has(task.tool as EditTool)
    ? (task.tool as EditTool)
    : "custom";
}
