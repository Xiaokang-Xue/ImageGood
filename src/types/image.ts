export type EditTool = "background" | "remove" | "enhance" | "style" | "expand" | "custom";
export type ImagePromptTool = EditTool | "product" | "poster";
export type ImageApiMode = "real" | "mock";
export type ImageProvider = "mock" | "codex" | "openai";
export type ImageQuality = "low" | "medium" | "high" | "auto";
export type ImageOutputFormat = "png" | "jpeg" | "webp";
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

export type ProductTemplate = "white-bg" | "lifestyle" | "festival" | "social";
export type ProductScene = "kitchen" | "bedroom" | "desk" | "outdoor" | "gift";
export type ProductStyle = "minimal" | "premium" | "warm" | "fresh";
export type ProductRatio = "1:1" | "3:4" | "4:3" | "16:9";

export type PosterUsage = "xiaohongshu" | "wechat" | "community" | "course" | "checkin";
export type PosterStyle = "clean" | "premium" | "cute" | "tech" | "handdrawn";
export type PosterRatio = "3:4" | "1:1" | "16:9" | "9:16" | "4:5";

export interface EditImageRequest {
  image?: File;
  imageUrl?: string;
  prompt?: string;
  tool: EditTool;
  size?: ImageSize | string;
  quality?: ImageQuality;
  outputFormat?: ImageOutputFormat;
}

export interface EditImageResult {
  id: string;
  url: string;
  type: "edited";
  label: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  createdAt: string;
  thumbnail: string;
}

export interface EditImageResponse {
  ok?: boolean;
  taskId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  mode: ImageApiMode;
  provider?: ImageProvider;
  results?: EditImageResult[];
  historyItem?: HistoryItem;
  latestCredits?: number;
}

export interface ProductImageRequest {
  image?: File;
  imageUrl?: string;
  template: ProductTemplate;
  scene: ProductScene;
  style: ProductStyle;
  sellingPoints: string;
  ratio: ProductRatio;
}

export interface ProductImageResult {
  id: string;
  url: string;
  template: string;
  title: string;
}

export interface ProductImageResponse {
  ok?: boolean;
  taskId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  mode: ImageApiMode;
  provider?: ImageProvider;
  results?: ProductImageResult[];
  latestCredits?: number;
}

export interface PosterImageRequest {
  title: string;
  subtitle: string;
  usage: PosterUsage;
  style: PosterStyle;
  ratio: PosterRatio;
}

export interface PosterImageResult {
  id: string;
  url: string;
  title: string;
}

export interface PosterImageResponse {
  ok?: boolean;
  taskId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  mode: ImageApiMode;
  provider?: ImageProvider;
  results?: PosterImageResult[];
  latestCredits?: number;
}

export interface ImageApiErrorBody {
  status: "failed";
  error: {
    code: string;
    message: string;
  };
}

export type ImageApiSuccessResponse = EditImageResponse | ProductImageResponse | PosterImageResponse;
export type ImageApiResponse = ImageApiSuccessResponse | ImageApiErrorBody;
