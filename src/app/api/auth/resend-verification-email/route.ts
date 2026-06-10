import { NextResponse } from "next/server";
import { AuthError, resendVerificationEmail } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后再重新发送验证邮件" } },
        { status: 401 }
      );
    }

    assertRateLimit(`resend-verification:${user.id}:${clientIp(request)}`, 4, 60_000);
    const result = await resendVerificationEmail(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "RATE_LIMITED", message: error.message } }, { status: 429 });
    }

    return NextResponse.json(
      { status: "failed", error: { code: "RESEND_VERIFICATION_FAILED", message: "验证邮件发送失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
