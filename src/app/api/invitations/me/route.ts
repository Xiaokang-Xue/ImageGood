import { NextResponse } from "next/server";
import { ensureUserInviteCode, InvitationError } from "@/lib/server/invitation-service";
import { listAvailableCoupons } from "@/lib/server/coupon-service";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
  try {
    const inviteCode = await ensureUserInviteCode(user.id);
    const { coupons } = await listAvailableCoupons(user.id);
    return NextResponse.json({
      inviteCode,
      availableCouponCount: coupons.length,
      availableCouponAmountCents: coupons.reduce((sum, coupon) => sum + coupon.amountCents, 0)
    });
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "INVITATION_FAILED", message: "邀请码生成失败，请稍后重试" } }, { status: 500 });
  }
}
