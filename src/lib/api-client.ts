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
import type {
  DeleteImageTaskResponse,
  DeleteImageTasksResponse,
  ImageTaskDetailResponse,
  ImageTaskListResponse,
  ImageTaskRecord
} from "@/types/task";
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

export interface TrackedImageTask {
  id: string;
  returnPath: string;
  createdAt: number;
}

const ACTIVE_IMAGE_TASKS_KEY = "imagegood:active-image-tasks:v1";
const ACTIVE_IMAGE_TASK_TTL_MS = 24 * 60 * 60 * 1000;

function createImageTaskRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getTrackedImageTasks() {
  if (typeof window === "undefined") return [] as TrackedImageTask[];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_IMAGE_TASKS_KEY) || "[]") as TrackedImageTask[];
    const cutoff = Date.now() - ACTIVE_IMAGE_TASK_TTL_MS;
    return Array.isArray(parsed)
      ? parsed.filter((task) => task && typeof task.id === "string" && Number(task.createdAt) >= cutoff).slice(-10)
      : [];
  } catch {
    return [] as TrackedImageTask[];
  }
}

function writeTrackedImageTasks(tasks: TrackedImageTask[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_IMAGE_TASKS_KEY, JSON.stringify(tasks.slice(-10)));
    window.dispatchEvent(new Event("imagegood-active-tasks-updated"));
  } catch {
    // Task persistence is a reliability enhancement; storage restrictions must not block generation.
  }
}

export function trackImageTask(task: TrackedImageTask) {
  const tasks = getTrackedImageTasks().filter((item) => item.id !== task.id);
  writeTrackedImageTasks([...tasks, task]);
}

export function forgetTrackedImageTask(taskId: string) {
  writeTrackedImageTasks(getTrackedImageTasks().filter((task) => task.id !== taskId));
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

function isTransientHttpStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function taskStartResponse<T>(task: ImageTaskRecord) {
  return {
    ok: true,
    taskId: task.id,
    status: task.status,
    mode: task.provider === "mock" ? "mock" : "real",
    provider: task.provider ?? undefined,
    results: []
  } as T;
}

async function recoverCreatedTask<T>(taskId: string) {
  try {
    const response = await requestJson<ImageTaskDetailResponse>(`/api/tasks/${taskId}`);
    return taskStartResponse<T>(response.task);
  } catch {
    return null;
  }
}

async function createTrackedTaskRequest<T>(input: {
  taskId: string;
  returnPath: string;
  request: () => Promise<Response>;
}) {
  trackImageTask({ id: input.taskId, returnPath: input.returnPath, createdAt: Date.now() });
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await input.request();
      if (response.ok) return parseResponse<T>(response);

      if (!isTransientHttpStatus(response.status)) {
        forgetTrackedImageTask(input.taskId);
        return parseResponse<T>(response);
      }

      const recovered = await recoverCreatedTask<T>(input.taskId);
      if (recovered) return recovered;
      lastError = new ImageApiClientError("TASK_CREATE_TEMPORARY_FAILURE", "网络暂时不稳定，正在确认任务状态");
    } catch (error) {
      lastError = error;
      const recovered = await recoverCreatedTask<T>(input.taskId);
      if (recovered) return recovered;
    }

    if (attempt < 2) await wait(800 * attempt);
  }

  for (let check = 0; check < 3; check += 1) {
    await wait(1000);
    const recovered = await recoverCreatedTask<T>(input.taskId);
    if (recovered) return recovered;
  }

  throw lastError instanceof Error
    ? lastError
    : new ImageApiClientError("TASK_CREATE_NETWORK_ERROR", "网络连接中断，系统会继续确认任务状态，请稍后在历史记录中查看");
}

async function postTrackedTaskForm<T>(path: string, formData: FormData, returnPath: string) {
  const taskId = createImageTaskRequestId();
  formData.set("requestId", taskId);
  return createTrackedTaskRequest<T>({
    taskId,
    returnPath,
    request: () => fetch(path, { method: "POST", body: formData })
  });
}

async function postTrackedTaskJson<T>(path: string, payload: Record<string, unknown>, returnPath: string) {
  const taskId = createImageTaskRequestId();
  return createTrackedTaskRequest<T>({
    taskId,
    returnPath,
    request: () =>
      fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, requestId: taskId })
      })
  });
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
  const isIosSafari =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const triggerDownload = (href: string) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = "noopener noreferrer";
    if (isIosSafari) anchor.target = "_blank";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  if (url.startsWith("data:")) {
    triggerDownload(url);
    return;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    triggerDownload(url);
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
    let consecutiveReadFailures = 0;

    while (Date.now() - startedAt <= timeoutMs) {
      if (options?.signal?.aborted) {
        const error = new Error("Request aborted");
        error.name = "AbortError";
        throw error;
      }
      try {
        const response = await apiClient.getTask(id);
        consecutiveReadFailures = 0;
        if (response.task.status === "succeeded" || response.task.status === "failed") {
          forgetTrackedImageTask(id);
          return response.task;
        }
      } catch (error) {
        if (isAbortError(error) || isUnauthorizedError(error)) throw error;

        const isRecentlyCreatedNotFound =
          error instanceof ImageApiClientError &&
          error.code === "TASK_NOT_FOUND" &&
          Date.now() - startedAt < 30_000;
        const isTransientReadError =
          !(error instanceof ImageApiClientError) ||
          ["REQUEST_FAILED", "TASK_READ_FAILED", "TASK_CREATE_TEMPORARY_FAILURE"].includes(error.code);

        if (!isRecentlyCreatedNotFound && !isTransientReadError) throw error;
        consecutiveReadFailures += 1;
      }
      const retryDelay = Math.min(10_000, intervalMs * Math.max(1, Math.min(consecutiveReadFailures, 5)));
      await wait(retryDelay, options?.signal);
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

    return postTrackedTaskForm<EditImageResponse>("/api/images/edit", formData, "/editor");
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

    return postTrackedTaskForm<ProductImageResponse>("/api/images/product", formData, "/product");
  },

  createPosterImages(payload: PosterImageRequest) {
    return postTrackedTaskJson<PosterImageResponse>("/api/images/poster", payload as unknown as Record<string, unknown>, "/poster");
  },

  createTextToImage(payload: TextToImageRequest) {
    return postTrackedTaskJson<TextToImageResponse>(
      "/api/images/text-to-image",
      payload as unknown as Record<string, unknown>,
      "/text-to-image"
    );
  },

  async removeBackground(payload: RemoveBackgroundRequest) {
    const image = await resolveImageFile(payload.image, payload.imageUrl, "remove-bg-input");
    const formData = new FormData();

    if (image) formData.append("image", image);
    formData.append("size", typeof payload.size === "string" ? payload.size : "1024x1024");
    formData.append("quality", payload.quality ?? "auto");

    return postTrackedTaskForm<RemoveBackgroundResponse>("/api/images/remove-background", formData, "/remove-background");
  },

  createImageToolTask(endpoint: string, payload: { image: File; prompt: string; returnPath: string }) {
    const formData = new FormData();
    formData.append("image", payload.image);
    formData.append("prompt", payload.prompt);
    formData.append("size", "1024x1024");
    formData.append("quality", "auto");
    return postTrackedTaskForm<EditImageResponse>(endpoint, formData, payload.returnPath);
  },

  listTemplates() {
    return requestJson<TemplateItem[]>("/api/templates");
  }
};
