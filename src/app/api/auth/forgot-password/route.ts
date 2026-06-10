import { NextResponse } from "next/server";
import { AuthError, requestPasswordResetEmail } from "@/lib/auth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertRateLimit(`forgot-password:${clientIp(request)}`, 6, 60_000);
    const body = (await request.json()) as Partial<{ email: string }>;
    const result = await requestPasswordResetEmail(body.email);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "RATE_LIMITED", message: error.message } }, { status: 429 });
    }

    return NextResponse.json(
      { status: "failed", error: { code: "FORGOT_PASSWORD_FAILED", message: "密码重置邮件发送失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
