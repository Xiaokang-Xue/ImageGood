import { NextResponse } from "next/server";
import { AuthError, changePassword } from "@/lib/auth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后再修改密码" } },
        { status: 401 }
      );
    }

    assertRateLimit(`change-password:${user.id}:${clientIp(request)}`, 6, 60_000);
    const body = await request.json();
    await changePassword(user.id, body);
    return NextResponse.json({ ok: true, message: "密码已更新" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ status: "failed", error: { code: "RATE_LIMITED", message: error.message } }, { status: 429 });
    }

    return NextResponse.json(
      { status: "failed", error: { code: "CHANGE_PASSWORD_FAILED", message: "修改密码失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
