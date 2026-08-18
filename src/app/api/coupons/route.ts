import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listAvailableCoupons } from "@/lib/server/coupon-service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
  return NextResponse.json(await listAvailableCoupons(user.id));
}
