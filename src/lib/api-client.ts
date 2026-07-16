"use client";

import type {
  EditImageRequest,
  EditImageResponse,
  ImageApiErrorBody,
  PosterImageRequest,
  PosterImageResponse,
  RemoveBackgroundRequest,
  RemoveBackgroundResponse,
  ProductImageRequest,
  ProductImageResponse,
  TextToImageRequest,
  TextToImageResponse
} from "@/types/image";
import type {
  AdminOrderRecord,
  BillingPackagesResponse,
  CreditPackageId,
  CreditTransactionsResponse,
  OrderDetailResponse,
  OrderRecord,
  PaymentCreateResponse,
  PaymentProvider,
  PaymentOrderResponse
} from "@/types/billing";
import type { AdminAnalyticsResponse, AnalyticsFunnelRange } from "@/types/analytics";
import type { DeleteImageTaskResponse, DeleteImageTasksResponse, ImageTaskDetailResponse, ImageTaskListResponse } from "@/types/task";
import type { TemplateItem } from "@/types/template";
import type { AuthResponse } from "@/types/user";
import { prepareImageFileForUpload } from "@/lib/client-image-normalizer";

export interface CaptchaResponse {
  question: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export class ImageApiClientError extends Error {
  code: string;
  actionUrl?: string;
  orderId?: string;

  constructor(code: string, message: string, options?: { actionUrl?: string; orderId?: string }) {
    super(message);
    this.name = "ImageApiClientError";
    this.code = code;
    this.actionUrl = options?.actionUrl;
    this.orderId = options?.orderId;
  }
}

function normalizeImageMime(type: string) {
  const mime = type.split(";")[0]?.trim().toLowerCase() || "";
  if (mime === "image/jpg") return "image/jpeg";
  return mime;
}

function fileExtensionFromMime(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  if (type === "image/avif") return "avif";
  if (type === "image/tiff") return "tiff";
  if (type === "image/gif") return "gif";
  if (type === "image/bmp" || type === "image/x-ms-bmp") return "bmp";
  return "png";
}

function mimeFromExtension(pathOrName: string) {
  const pathname = pathOrName.split("?")[0]?.split("#")[0] || "";
  const extension = pathname.toLowerCase().match(/\.[^.]+$/)?.[0] || "";

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".heic") return "image/heic";
  if (extension === ".heif") return "image/heif";
  if (extension === ".avif") return "image/avif";
  if (extension === ".tif" || extension === ".tiff") return "image/tiff";
  if (extension === ".gif") return "image/gif";
  if (extension === ".bmp") return "image/bmp";
  return "";
}

function mimeFromBytes(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return "image/tiff";
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif")) {
    return "image/avif";
  }
  if (bytes.length >= 12) {
    const brand = String.fromCharCode(...bytes.slice(4, 12));
    if (brand.includes("ftypheic") || brand.includes("ftypheix") || brand.includes("ftyphevc") || brand.includes("ftyphevx")) {
      return "image/heic";
    }
    if (brand.includes("ftypmif1") || brand.includes("ftypmsf1")) {
      return "image/heif";
    }
  }
  return "";
}

function mimeFromArrayBuffer(buffer: ArrayBuffer) {
  return mimeFromBytes(new Uint8Array(buffer));
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, base64] = dataUrl.split(",");
  const headerMime = normalizeImageMime(header.match(/data:(.*?);base64/)?.[1] || "");
  const bytes = window.atob(base64);
  const chunks = new Uint8Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    chunks[index] = bytes.charCodeAt(index);
  }

  const detectedMime = mimeFromBytes(chunks);
  const mime = detectedMime || headerMime || mimeFromExtension(filename) || "application/octet-stream";
  return new File([chunks], `${filename}.${fileExtensionFromMime(mime)}`, { type: mime });
}

export async function imageUrlToUploadFile(imageUrl: string, filename: string) {
  if (imageUrl.startsWith("data:")) {
    return dataUrlToFile(imageUrl, filename);
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new ImageApiClientError("IMAGE_READ_FAILED", "无法读取当前图片，请重新上传后再试");
  }

  const arrayBuffer = await response.arrayBuffer();
  const responseMime = normalizeImageMime(response.headers.get("content-type") || "");
  const detectedMime = mimeFromArrayBuffer(arrayBuffer);
  const extensionMime = mimeFromExtension(imageUrl);
  const mime = detectedMime || responseMime || extensionMime || "application/octet-stream";

  return new File([arrayBuffer], `${filename}.${fileExtensionFromMime(mime)}`, {
    type: mime
  });
}

async function resolveImageFile(image?: File, imageUrl?: string, filename = "input-image") {
  if (image) return prepareImageFileForUpload(image);
  if (!imageUrl) return undefined;

  try {
    const file = await imageUrlToUploadFile(imageUrl, filename);
    return await prepareImageFileForUpload(file);
  } catch (error) {
    if (error instanceof ImageApiClientError) throw error;
    throw new ImageApiClientError("IMAGE_READ_FAILED", "无法读取当前图片，请重新上传后再试");
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ImageApiErrorBody | null;

  if (!response.ok) {
    const errorBody = payload as ImageApiErrorBody | null;
    throw new ImageApiClientError(
      errorBody?.error?.code || "REQUEST_FAILED",
      errorBody?.error?.message || `请求失败：${response.status}`,
      {
        actionUrl: errorBody?.error?.actionUrl,
        orderId: errorBody?.error?.orderId
      }
    );
  }

  return payload as T;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  return parseResponse<T>(response);
}

async function postForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    body: formData
  });

  return parseResponse<T>(response);
}

export function getImageErrorMessage(error: unknown) {
  if (error instanceof ImageApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message || "网络请求失败，请稍后重试";
  }

  return "网络请求失败，请稍后重试";
}

export function isUnauthorizedError(error: unknown): error is ImageApiClientError {
  return error instanceof ImageApiClientError && error.code === "UNAUTHORIZED";
}

export function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}

export function isInsufficientCreditsError(error: unknown): error is ImageApiClientError {
  return error instanceof ImageApiClientError && error.code === "INSUFFICIENT_CREDITS";
}

export function isPaymentSourceSurveyRequiredError(error: unknown): error is ImageApiClientError {
  return error instanceof ImageApiClientError && error.code === "SOURCE_SURVEY_REQUIRED";
}

export function isEmailNotVerifiedError(error: unknown): error is ImageApiClientError {
  return error instanceof ImageApiClientError && (error.code === "EMAIL_NOT_VERIFIED" || error.code === "CONTACT_NOT_VERIFIED");
}

export const isContactNotVerifiedError = isEmailNotVerifiedError;

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error("Request aborted");
      error.name = "AbortError";
      reject(error);
      return;
    }

    const handleAbort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", handleAbort);
      const error = new Error("Request aborted");
      error.name = "AbortError";
      reject(error);
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function downloadImage(url: string, filename = `ai-image-result-${Date.now()}.png`) {
  const anchor = document.createElement("a");
  anchor.download = filename;

  if (url.startsWith("data:")) {
    anchor.href = url;
    anchor.click();
    return;
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    anchor.href = objectUrl;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.click();
  }
}

export const apiClient = {
  captcha() {
    return requestJson<CaptchaResponse>("/api/captcha");
  },

  register(payload: { name: string; email: string; password: string; confirmPassword: string; captchaAnswer: string }) {
    return requestJson<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  sendSmsCode(payload: { phone: string; scene: "register" | "login" | "bind_phone" | "change_phone" }) {
    return requestJson<{ ok: boolean; message: string }>("/api/auth/sms/send-code", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  registerPhone(payload: { name: string; phone: string; code: string; password: string; confirmPassword: string }) {
    return requestJson<AuthResponse>("/api/auth/register-phone", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  login(payload: { email: string; password: string; captchaAnswer: string }) {
    return requestJson<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  loginPhone(payload: { phone: string; code?: string; password?: string }) {
    return requestJson<AuthResponse>("/api/auth/login-phone", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  bindPhone(payload: { phone: string; code: string; scene: "bind_phone" | "change_phone" }) {
    return requestJson<AuthResponse & { message?: string }>("/api/auth/phone", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  logout() {
    return requestJson<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  },

  me() {
    return requestJson<AuthResponse>("/api/auth/me");
  },

  changePassword(payload: { oldPassword: string; newPassword: string }) {
    return requestJson<{ ok: boolean; message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  forgotPassword(payload: { email: string }) {
    return requestJson<ForgotPasswordResponse>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  resetPassword(payload: { token: string; password: string; confirmPassword: string }) {
    return requestJson<{ ok: boolean; message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  verifyEmail(payload: { token: string }) {
    return requestJson<{ ok: boolean; message: string }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  resendVerificationEmail() {
    return requestJson<{ ok: boolean; message: string; emailVerified?: boolean }>("/api/auth/resend-verification-email", {
      method: "POST",
      body: JSON.stringify({})
    });
  },

  createOrder(payload: { packageId: CreditPackageId }) {
    return requestJson<{ orderId: string; order: OrderRecord }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  listBillingPackages() {
    return requestJson<BillingPackagesResponse>("/api/billing/packages");
  },

  createPaymentOrder(payload: { packageId: CreditPackageId; provider?: Exclude<PaymentProvider, "manual"> }) {
    return requestJson<PaymentCreateResponse>("/api/payment/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  getPaymentOrder(id: string) {
    return requestJson<PaymentOrderResponse>(`/api/payment/orders/${id}`);
  },

  getPaymentOrderByOutTradeNo(outTradeNo: string) {
    return requestJson<PaymentOrderResponse>(`/api/payment/orders/by-out-trade-no/${encodeURIComponent(outTradeNo)}`);
  },

  markMockPaymentPaid(orderId: string) {
    return requestJson<{ latestCredits: number }>(`/api/payment/mock/mark-paid`, {
      method: "POST",
      body: JSON.stringify({ orderId })
    });
  },

  getOrder(id: string) {
    return requestJson<OrderDetailResponse>(`/api/orders/${id}`);
  },

  updateOrderRemark(id: string, payload: { remark: string }) {
    return requestJson<OrderDetailResponse>(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  listCreditTransactions() {
    return requestJson<CreditTransactionsResponse>("/api/credits/transactions");
  },

  listAdminOrders(options?: {
    page?: number;
    limit?: number;
    status?: AdminOrderRecord["status"] | "all";
    provider?: AdminOrderRecord["paymentProvider"] | "all";
  }) {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.status && options.status !== "all") params.set("status", options.status);
    if (options?.provider && options.provider !== "all") params.set("provider", options.provider);
    const query = params.toString();
    return requestJson<{
      orders: AdminOrderRecord[];
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    }>(`/api/admin/orders${query ? `?${query}` : ""}`);
  },

  getAdminAnalytics(options?: { range?: AnalyticsFunnelRange; refresh?: boolean }) {
    const params = new URLSearchParams();
    if (options?.range) params.set("range", options.range);
    if (options?.refresh) params.set("refresh", "1");
    const query = params.toString();
    return requestJson<AdminAnalyticsResponse>(`/api/admin/analytics${query ? `?${query}` : ""}`);
  },

  confirmAdminOrder(id: string) {
    return requestJson<{ order: OrderRecord; latestCredits: number }>(`/api/admin/orders/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({})
    });
  },

  listTasks(options?: { page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    const query = params.toString();
    return requestJson<ImageTaskListResponse>(`/api/tasks${query ? `?${query}` : ""}`);
  },

  getTask(id: string) {
    return requestJson<ImageTaskDetailResponse>(`/api/tasks/${id}`);
  },

  deleteTask(id: string) {
    return requestJson<DeleteImageTaskResponse>(`/api/tasks/${id}`, {
      method: "DELETE",
      body: JSON.stringify({})
    });
  },

  deleteTasks(taskIds: string[]) {
    return requestJson<DeleteImageTasksResponse>("/api/tasks", {
      method: "DELETE",
      body: JSON.stringify({ taskIds })
    });
  },

  async waitForTaskDone(id: string, options?: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal }) {
    const intervalMs = options?.intervalMs ?? 2000;
    const timeoutMs = options?.timeoutMs ?? 60 * 60 * 1000;
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      if (options?.signal?.aborted) {
        const error = new Error("Request aborted");
        error.name = "AbortError";
        throw error;
      }
      const response = await apiClient.getTask(id);
      if (response.task.status === "succeeded" || response.task.status === "failed") {
        return response.task;
      }
      await wait(intervalMs, options?.signal);
    }

    throw new ImageApiClientError("TASK_POLL_TIMEOUT", "图片生成时间较长，请稍后在历史记录中查看结果");
  },

  async editImage(payload: EditImageRequest) {
    const image = await resolveImageFile(payload.image, payload.imageUrl, "edit-input");
    const formData = new FormData();

    if (image) formData.append("image", image);
    formData.append("prompt", payload.prompt ?? "");
    formData.append("tool", payload.tool);
    formData.append("size", payload.size ?? "1024x1024");
    formData.append("quality", payload.quality ?? "auto");
    formData.append("outputFormat", payload.outputFormat ?? "png");

    return postForm<EditImageResponse>("/api/images/edit", formData);
  },

  async createProductImages(payload: ProductImageRequest) {
    const image = await resolveImageFile(payload.image, payload.imageUrl, "product-input");
    const formData = new FormData();

    if (image) formData.append("image", image);
    formData.append("template", payload.template);
    formData.append("scene", payload.scene);
    formData.append("style", payload.style);
    formData.append("sellingPoints", payload.sellingPoints);
    formData.append("ratio", payload.ratio);

    return postForm<ProductImageResponse>("/api/images/product", formData);
  },

  createPosterImages(payload: PosterImageRequest) {
    return requestJson<PosterImageResponse>("/api/images/poster", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  createTextToImage(payload: TextToImageRequest) {
    return requestJson<TextToImageResponse>("/api/images/text-to-image", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async removeBackground(payload: RemoveBackgroundRequest) {
    const image = await resolveImageFile(payload.image, payload.imageUrl, "remove-bg-input");
    const formData = new FormData();

    if (image) formData.append("image", image);
    formData.append("size", typeof payload.size === "string" ? payload.size : "1024x1024");
    formData.append("quality", payload.quality ?? "auto");

    return postForm<RemoveBackgroundResponse>("/api/images/remove-background", formData);
  },

  listTemplates() {
    return requestJson<TemplateItem[]>("/api/templates");
  }
};
