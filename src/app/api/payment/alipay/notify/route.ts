import { NextResponse } from "next/server";
import { handleAlipayPaymentNotify } from "@/lib/server/payment/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    await handleAlipayPaymentNotify(rawBody);
    return new Response("success", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  } catch (error) {
    console.error("[payment] alipay notify failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error)
    });

    return new Response("failure", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
}

export async function GET() {
  return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "支付宝异步通知接口仅支持 POST" } }, { status: 405 });
}
