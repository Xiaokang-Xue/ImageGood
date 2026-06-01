import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { markMockPaymentPaid, PaymentError } from "@/lib/server/payment/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
    }

    const body = (await request.json()) as Partial<{ orderId: string }>;
    const result = await markMockPaymentPaid(user, String(body.orderId || ""));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "MOCK_PAYMENT_FAILED", message: "模拟支付失败，请稍后重试" } }, { status: 500 });
  }
}
