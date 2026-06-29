import type { EditTool, ImageProvider } from "@/types/image";

export type ImageTaskType =
  | "edit"
  | "product"
  | "poster"
  | "text_to_image"
  | "remove_background"
  | "image_enhance"
  | "object_remove";
export type ImageTaskStatus = "pending" | "processing" | "succeeded" | "failed";
export type ImageTaskTool =
  | EditTool
  | "product"
  | "poster"
  | "text_to_image"
  | "remove_background"
  | "image_enhance"
  | "object_remove";

export interface ImageTaskRecord {
  id: string;
  userId: string;
  type: ImageTaskType;
  prompt: string;
  tool?: ImageTaskTool | null;
  status: ImageTaskStatus;
  provider?: ImageProvider | null;
  inputImageUrl?: string | null;
  resultImageUrl?: string | null;
  resultImages?: string[] | null;
  creditCharged?: boolean;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageTaskListResponse {
  ok?: boolean;
  tasks: ImageTaskRecord[];
}

export interface ImageTaskDetailResponse {
  ok?: boolean;
  task: ImageTaskRecord;
}

export interface DeleteImageTaskResponse {
  ok: boolean;
  deletedId: string;
}

export interface DeleteImageTasksResponse {
  ok: boolean;
  deletedIds: string[];
  skippedIds: string[];
}
