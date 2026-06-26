import "server-only";
import type { PublicUser } from "@/types/user";

export class ContactNotVerifiedError extends Error {
  code = "CONTACT_NOT_VERIFIED";
  status = 403;

  constructor(message = "请先完成手机号或邮箱验证后再使用该功能") {
    super(message);
    this.name = "ContactNotVerifiedError";
  }
}

export class EmailNotVerifiedError extends ContactNotVerifiedError {
  constructor(message = "请先完成邮箱验证后再使用该功能") {
    super(message);
    this.name = "EmailNotVerifiedError";
    this.code = "EMAIL_NOT_VERIFIED";
  }
}

export class PaymentSourceSurveyRequiredError extends Error {
  code = "SOURCE_SURVEY_REQUIRED";
  status = 403;
  orderId: string;
  actionUrl: string;

  constructor(orderId: string, message = "请先补充支付来源渠道后再继续生成图片") {
    super(message);
    this.name = "PaymentSourceSurveyRequiredError";
    this.orderId = orderId;
    this.actionUrl = `/checkout/${orderId}`;
  }
}

export function hasVerifiedContact(user: PublicUser) {
  return Boolean(user.phoneVerified || user.emailVerified || user.hasVerifiedContact);
}

export function assertContactVerified(user: PublicUser) {
  if (!hasVerifiedContact(user)) {
    throw new ContactNotVerifiedError();
  }
}

export const assertEmailVerified = assertContactVerified;

export function emailNotVerifiedBody() {
  return {
    status: "failed",
    error: {
      code: "CONTACT_NOT_VERIFIED",
      message: "请先完成手机号或邮箱验证后再使用该功能"
    }
  };
}

export const contactNotVerifiedBody = emailNotVerifiedBody;
