"use client";

import type {
  EditImageRequest,
  EditImageResponse,
  ImageApiErrorBody,
  PosterImageRequest,
  PosterImageResponse,
  ProductImageRequest,
  ProductImageResponse
} from "@/types/image";
import type {
  AdminOrderRecord,
  BillingPackagesResponse,
  CreditPackageId,
  CreditTransactionsResponse,
  OrderDetailResponse,
  OrderRecord,
  PaymentCreateResponse,
  PaymentOrderResponse
} from "@/types/billing";
import type { ImageTaskDetailResponse, ImageTaskListResponse } from "@/types/task";
import type { TemplateItem } from "@/types/template";
import type { AuthResponse } from "@/types/user";

export interface CaptchaResponse {
  question: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetUrl: string | null;
}

export class ImageApiClientError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ImageApiClientError";
    this.code = code;
  }
}

function fileExtensionFromMime(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bytes = window.atob(base64);
  const chunks = new Uint8Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    chunks[index] = bytes.charCodeAt(index);
  }

  return new File([chunks], filename, { type: mime });
}

async function imageUrlToFile(imageUrl: string, filename: string) {
  if (imageUrl.startsWith("data:")) {
    return dataUrlToFile(imageUrl, filename);
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new ImageApiClientError("IMAGE_READ_FAILED", "无法读取当前图片，请重新上传后再试");
  }

  const blob = await response.blob();
  return new File([blob], `${filename}.${fileExtensionFromMime(blob.type)}`, {
    type: blob.type || "image/png"
  });
}

async function resolveImageFile(image?: File, imageUrl?: string, filename = "input-image") {
  if (image) return image;
  if (!imageUrl) return undefined;

  try {
    return await imageUrlToFile(imageUrl, filename);
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
      errorBody?.error?.message || `请求失败：${response.status}`
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

export function isUnauthorizedError(error: unknown) {
  return error instanceof ImageApiClientError && error.code === "UNAUTHORIZED";
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

  login(payload: { email: string; password: string; captchaAnswer: string }) {
    return requestJson<AuthResponse>("/api/auth/login", {
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

  resetPassword(payload: { token: string; newPassword: string }) {
    return requestJson<{ ok: boolean; message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload)
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

  createPaymentOrder(payload: { packageId: CreditPackageId }) {
    return requestJson<PaymentCreateResponse>("/api/payment/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  getPaymentOrder(id: string) {
    return requestJson<PaymentOrderResponse>(`/api/payment/orders/${id}`);
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

  listAdminOrders() {
    return requestJson<{ orders: AdminOrderRecord[] }>("/api/admin/orders");
  },

  confirmAdminOrder(id: string) {
    return requestJson<{ order: OrderRecord; latestCredits: number }>(`/api/admin/orders/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({})
    });
  },

  listTasks() {
    return requestJson<ImageTaskListResponse>("/api/tasks");
  },

  getTask(id: string) {
    return requestJson<ImageTaskDetailResponse>(`/api/tasks/${id}`);
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

  listTemplates() {
    return requestJson<TemplateItem[]>("/api/templates");
  }
};
