import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPaymentOrderResponse } from "@/lib/server/payment/payment-service";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "请先登录后查看订单" } }, { status: 401 });
  }

  const order = await getPaymentOrderResponse(params.id, user);
  if (!order) {
    return NextResponse.json({ error: { code: "ORDER_NOT_FOUND", message: "订单不存在或已被删除" } }, { status: 404 });
  }

  return NextResponse.json(order);
}
