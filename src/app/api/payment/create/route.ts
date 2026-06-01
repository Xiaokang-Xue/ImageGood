import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { PaymentError, createPaymentOrder } from "@/lib/server/payment/payment-service";
import type { CreditPackageId } from "@/types/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录后再购买积分" } }, { status: 401 });
    }

    const body = (await request.json()) as Partial<{ packageId: CreditPackageId }>;
    const order = await createPaymentOrder(user.id, String(body.packageId || "") as CreditPackageId);

    return NextResponse.json({
      orderId: order.id,
      outTradeNo: order.outTradeNo,
      status: order.status,
      paymentProvider: order.paymentProvider,
      paymentMethod: order.paymentMethod,
      codeUrl: order.codeUrl
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "PAYMENT_CREATE_FAILED", message: "创建支付订单失败，请稍后重试" } }, { status: 500 });
  }
}
