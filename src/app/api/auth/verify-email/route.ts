import { NextResponse } from "next/server";
import { AuthError, verifyEmailToken } from "@/lib/auth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertRateLimit(`verify-email:${clientIp(request)}`, 10, 60_000);
    const body = await request.json();
    await verifyEmailToken(body);
    return NextResponse.json({ ok: true, message: "邮箱验证成功，现在可以使用完整功能。" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "RATE_LIMITED", message: error.message } }, { status: 429 });
    }

    return NextResponse.json(
      { status: "failed", error: { code: "VERIFY_EMAIL_FAILED", message: "邮箱验证失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
