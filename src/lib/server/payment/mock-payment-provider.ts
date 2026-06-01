import "server-only";
import type { CreateNativePaymentInput, CreateNativePaymentResult, PaymentProvider } from "@/lib/server/payment/payment-provider";

export class MockPaymentProvider implements PaymentProvider {
  async createNativePayment(input: CreateNativePaymentInput): Promise<CreateNativePaymentResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const codeUrl = `weixin://wxpay/mock?orderId=${encodeURIComponent(input.order.id)}&outTradeNo=${encodeURIComponent(input.order.outTradeNo)}&return=${encodeURIComponent(appUrl)}`;
    return { codeUrl };
  }
}
