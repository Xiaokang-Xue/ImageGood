import { NextResponse } from "next/server";
import { handleWechatPaymentNotify, PaymentError } from "@/lib/server/payment/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    await handleWechatPaymentNotify(rawBody, request.headers);
    return NextResponse.json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "微信支付回调处理失败";
    const status = error instanceof PaymentError ? error.status : 400;
    return NextResponse.json({ code: "FAIL", message }, { status });
  }
}
