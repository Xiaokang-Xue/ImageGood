import { NextResponse } from "next/server";
import { contactNotVerifiedBody, hasVerifiedContact } from "@/lib/server/auth-guards";
import { getCurrentUser } from "@/lib/session";
import { PaymentError, createPaymentOrder } from "@/lib/server/payment/payment-service";
import type { CreditPackageId } from "@/types/billing";
import type { PaymentProviderName } from "@/lib/server/payment/payment-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录后再购买积分" } }, { status: 401 });
    }
    if (!hasVerifiedContact(user)) {
      return NextResponse.json(contactNotVerifiedBody(), { status: 403 });
    }

    const body = (await request.json()) as Partial<{ packageId: CreditPackageId; provider: PaymentProviderName }>;
    const provider = body.provider === "wechat" ? "wechat" : "alipay";
    const order = await createPaymentOrder(user.id, String(body.packageId || "") as CreditPackageId, provider);

    return NextResponse.json({
      orderId: order.id,
      outTradeNo: order.outTradeNo,
      status: order.status,
      paymentProvider: order.paymentProvider,
      paymentMethod: order.paymentMethod,
      codeUrl: order.codeUrl ?? null,
      paymentUrl: order.paymentUrl ?? null
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ status: "failed", error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json(
      { status: "failed", error: { code: "PAYMENT_CREATE_FAILED", message: "创建支付订单失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
