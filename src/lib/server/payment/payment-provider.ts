import type { OrderRecord } from "@/types/billing";

export type PaymentProviderName = "wechat" | "alipay";
export type PaymentMethodName = "native" | "page";

export interface CreateNativePaymentInput {
  order: OrderRecord;
  description: string;
  notifyUrl: string;
  returnUrl?: string;
}

export interface CreateNativePaymentResult {
  provider: PaymentProviderName;
  paymentMethod: PaymentMethodName;
  codeUrl?: string;
  paymentUrl?: string;
  raw?: unknown;
}

export interface WechatPaymentNotification {
  appid?: string;
  mchid: string;
  out_trade_no: string;
  transaction_id?: string;
  trade_state: string;
  amount?: {
    total?: number;
    payer_total?: number;
    currency?: string;
    payer_currency?: string;
  };
}

export interface PaymentProvider {
  createPayment(input: CreateNativePaymentInput): Promise<CreateNativePaymentResult>;
}
