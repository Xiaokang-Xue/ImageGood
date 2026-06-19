import { NextResponse } from "next/server";
import { AuthError, bindOrChangePhone } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AuthError("UNAUTHORIZED", "请先登录", 401);
    }

    const body = await request.json();
    const result = await bindOrChangePhone(user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json(
      { status: "failed", error: { code: "PHONE_BIND_FAILED", message: "手机号绑定失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
