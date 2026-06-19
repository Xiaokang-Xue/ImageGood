import { NextResponse } from "next/server";
import { AuthError, sendPhoneSmsCode } from "@/lib/auth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    assertRateLimit(`sms-send:${ip}`, 20, 60 * 60 * 1000);
    const body = await request.json();
    const user = await getCurrentUser();
    const result = await sendPhoneSmsCode(body, { userId: user?.id, ip });
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "SMS_RATE_LIMITED", message: error.message } }, { status: 429 });
    }
    return NextResponse.json(
      { status: "failed", error: { code: "SMS_SEND_FAILED", message: "验证码发送失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
