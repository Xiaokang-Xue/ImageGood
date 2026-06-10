import { NextResponse } from "next/server";
import { AuthError, loginUser } from "@/lib/auth";
import { verifyCaptchaAnswer } from "@/lib/captcha";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertRateLimit(`login:${clientIp(request)}`, 8, 60_000);
    const body = await request.json();
    if (!verifyCaptchaAnswer(body?.captchaAnswer)) {
      throw new AuthError("CAPTCHA_INVALID", "验证码错误");
    }
    const user = await loginUser(body);
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
