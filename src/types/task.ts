import type { EditTool, ImageProvider } from "@/types/image";

export type ImageTaskType = "edit" | "product" | "poster";
export type ImageTaskStatus = "pending" | "processing" | "succeeded" | "failed";

export interface ImageTaskRecord {
  id: string;
  userId: string;
  type: ImageTaskType;
  prompt: string;
  tool?: EditTool | "product" | "poster" | null;
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
