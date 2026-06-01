import type { OrderRecord } from "@/types/billing";

export interface CreateNativePaymentInput {
  order: OrderRecord;
  description: string;
  notifyUrl: string;
}

export interface CreateNativePaymentResult {
  codeUrl: string;
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
  createNativePayment(input: CreateNativePaymentInput): Promise<CreateNativePaymentResult>;
}
