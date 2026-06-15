import "server-only";
import type { CreateNativePaymentInput, CreateNativePaymentResult, PaymentProvider } from "@/lib/server/payment/payment-provider";

export class MockPaymentProvider implements PaymentProvider {
  async createPayment(input: CreateNativePaymentInput): Promise<CreateNativePaymentResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    if (input.order.paymentProvider === "alipay") {
      const paymentUrl = `${appUrl.replace(/\/$/, "")}/checkout/alipay/return?orderId=${encodeURIComponent(input.order.id)}&out_trade_no=${encodeURIComponent(input.order.outTradeNo)}&mock=1`;
      return {
        provider: "alipay",
        paymentMethod: "page",
        paymentUrl
      };
    }

    const codeUrl = `weixin://wxpay/mock?orderId=${encodeURIComponent(input.order.id)}&outTradeNo=${encodeURIComponent(input.order.outTradeNo)}&return=${encodeURIComponent(appUrl)}`;
    return {
      provider: "wechat",
      paymentMethod: "native",
      codeUrl
    };
  }
}
