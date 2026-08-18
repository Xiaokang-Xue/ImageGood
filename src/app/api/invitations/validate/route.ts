import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "INVITE_CODE_REGISTRATION_ONLY",
        message: "邀请码仅可在注册时填写，注册成功后优惠券会自动发放"
      }
    },
    { status: 410 }
  );
}
