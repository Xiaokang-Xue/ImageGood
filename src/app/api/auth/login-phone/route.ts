import { NextResponse } from "next/server";
import { AuthError, loginPhoneUser } from "@/lib/auth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertRateLimit(`login-phone:${clientIp(request)}`, 10, 60_000);
    const body = await request.json();
    const user = await loginPhoneUser(body);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "RATE_LIMITED", message: error.message } }, { status: 429 });
    }
    return NextResponse.json(
      { status: "failed", error: { code: "LOGIN_FAILED", message: "登录失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
