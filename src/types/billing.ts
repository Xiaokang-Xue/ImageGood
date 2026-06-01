export type CreditTransactionType = "grant" | "consume" | "purchase" | "refund" | "admin_adjust";
export type OrderStatus = "pending" | "paid" | "cancelled" | "expired" | "failed";
export type PaymentProvider = "wechat" | "manual";
export type PaymentMethod = "native" | "manual";
export type CreditPackageId = "starter" | "standard" | "pro" | "business";

export interface CreditPackage {
  id: CreditPackageId;
  name: string;
  priceCents: number;
  credits: number;
  subtitle: string;
}

export interface BillingPackagesResponse {
  packages: CreditPackage[];
}

export interface CreditTransactionRecord {
  id: string;
  userId: string;
  orderId?: string | null;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  userId: string;
  packageId: CreditPackageId;
  packageName: string;
  amountCents: number;
  credits: number;
  status: OrderStatus;
  paymentProvider: PaymentProvider;
  paymentMethod: PaymentMethod;
  outTradeNo: string;
  transactionId?: string | null;
  codeUrl?: string | null;
  remark?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  expiredAt?: string | null;
}

export interface AdminOrderRecord extends OrderRecord {
  userEmail: string;
  userName?: string | null;
}

export interface OrderDetailResponse {
  order: OrderRecord;
}

export interface CreditTransactionsResponse {
  transactions: CreditTransactionRecord[];
}

export interface PaymentCreateResponse {
  orderId: string;
  outTradeNo: string;
  status: OrderStatus;
  paymentProvider: PaymentProvider;
  paymentMethod: PaymentMethod;
  codeUrl: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  status: OrderStatus;
  packageName: string;
  amountCents: number;
  credits: number;
  codeUrl: string | null;
  paidAt: string | null;
  currentCredits: number;
  paymentProvider: PaymentProvider;
  paymentMethod: PaymentMethod;
  outTradeNo: string;
  transactionId: string | null;
  expiredAt: string | null;
  paymentMode: "mock" | "real";
}
