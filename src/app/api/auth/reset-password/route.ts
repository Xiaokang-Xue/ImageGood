import { NextResponse } from "next/server";
import { AuthError, resetPassword } from "@/lib/auth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertRateLimit(`reset-password:${clientIp(request)}`, 8, 60_000);
    const body = await request.json();
    await resetPassword(body);
    return NextResponse.json({ ok: true, message: "密码已重置，请使用新密码登录。" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "RATE_LIMITED", message: error.message } }, { status: 429 });
    }

    return NextResponse.json(
      { status: "failed", error: { code: "RESET_PASSWORD_FAILED", message: "重置密码失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
