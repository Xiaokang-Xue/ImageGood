import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing";
import { ContactNotVerifiedError, EmailNotVerifiedError, PaymentSourceSurveyRequiredError } from "@/lib/server/auth-guards";
import { ImageRequestError } from "@/lib/server/image-validation";

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function imageErrorResponse(error: unknown) {
  if (error instanceof ImageRequestError) {
    return NextResponse.json(
      {
        status: "failed",
        error: {
          code: error.code,
          message: error.message
        }
      },
      { status: error.status }
    );
  }

  if (error instanceof BillingError) {
    return NextResponse.json(
      {
        status: "failed",
        error: {
          code: error.code,
          message: error.message
        }
      },
      { status: error.status }
    );
  }

  if (error instanceof ContactNotVerifiedError || error instanceof EmailNotVerifiedError) {
    return NextResponse.json(
      {
        status: "failed",
        error: {
          code: error.code || "CONTACT_NOT_VERIFIED",
          message: error.message
        }
      },
      { status: error.status }
    );
  }

  if (error instanceof PaymentSourceSurveyRequiredError) {
    return NextResponse.json(
      {
        status: "failed",
        error: {
          code: error.code,
          message: error.message,
          orderId: error.orderId,
          actionUrl: error.actionUrl
        }
      },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : "图片生成失败，请稍后重试";
  const lowerMessage = message.toLowerCase();
  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      {
        status: "failed",
        error: {
          code: "UNAUTHORIZED",
          message: "请先登录后再使用图片生成功能"
        }
      },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      status: "failed",
      error: {
        code:
          message.includes("返回结果为空") || message.includes("空图片")
            ? "EMPTY_MODEL_RESULT"
            : lowerMessage.includes("invalid image file") || lowerMessage.includes("image file or mode")
              ? "INVALID_IMAGE_FILE"
              : "MODEL_CALL_FAILED",
        message:
          lowerMessage.includes("invalid image file") || lowerMessage.includes("image file or mode")
            ? "图片格式需要自动优化，系统正在重新处理"
            : message.includes("OpenAI SDK")
              ? message
              : `模型调用失败：${message}`
      }
    },
    { status: 502 }
  );
}
