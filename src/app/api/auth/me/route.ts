import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }

  return NextResponse.json({ user });
}
