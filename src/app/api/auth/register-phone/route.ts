import { NextResponse } from "next/server";
import { AuthError, registerPhoneUser } from "@/lib/auth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertRateLimit(`register-phone:${clientIp(request)}`, 8, 60_000);
    const body = await request.json();
    const result = await registerPhoneUser(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "RATE_LIMITED", message: error.message } }, { status: 429 });
    }
    return NextResponse.json(
      { status: "failed", error: { code: "REGISTER_FAILED", message: "注册失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
