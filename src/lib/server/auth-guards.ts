import "server-only";
import type { PublicUser } from "@/types/user";

export class EmailNotVerifiedError extends Error {
  code = "EMAIL_NOT_VERIFIED";
  status = 403;

  constructor(message = "请先完成邮箱验证后再使用该功能") {
    super(message);
    this.name = "EmailNotVerifiedError";
  }
}

export function assertEmailVerified(user: PublicUser) {
  if (!user.emailVerified) {
    throw new EmailNotVerifiedError();
  }
}

export function emailNotVerifiedBody() {
  return {
    status: "failed",
    error: {
      code: "EMAIL_NOT_VERIFIED",
      message: "请先完成邮箱验证后再使用该功能"
    }
  };
}
