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
export type ImageTaskTimeRange = "all" | "today" | "7d" | "30d";
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
  title?: string | null;
  isFavorite?: boolean;
  tool?: ImageTaskTool | null;
  status: ImageTaskStatus;
  provider?: ImageProvider | null;
  inputImageUrl?: string | null;
  inputImagePreviewUrl?: string | null;
  resultImageUrl?: string | null;
  resultImages?: string[] | null;
  resultImagePreviewUrl?: string | null;
  resultImagePreviewUrls?: string[] | null;
  resultImagePlaceholderUrl?: string | null;
  resultImagePlaceholderUrls?: string[] | null;
  isFreeTrial?: boolean;
  hasWatermark?: boolean;
  unlockedAt?: string | null;
  creditCharged?: boolean;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageTaskListResponse {
  ok?: boolean;
  tasks: ImageTaskRecord[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  summary: {
    total: number;
    succeeded: number;
    latestCreatedAt: string | null;
  };
}

export interface ImageTaskListOptions {
  page?: number;
  limit?: number;
  type?: ImageTaskType | "all";
  status?: ImageTaskStatus | "all";
  timeRange?: ImageTaskTimeRange;
  favorite?: boolean;
}

export interface UpdateImageTaskResponse {
  ok: boolean;
  task: ImageTaskRecord;
}

export interface ImageTaskDetailResponse {
  ok?: boolean;
  task: ImageTaskRecord;
}

export interface AdminImageTaskRecord extends ImageTaskRecord {
  originalResultImages?: string[] | null;
  userAccount: string;
  userName: string | null;
}

export interface AdminImageTaskListResponse {
  tasks: AdminImageTaskRecord[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
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
