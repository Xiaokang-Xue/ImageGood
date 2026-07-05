export type CreditTransactionType = "grant" | "consume" | "purchase" | "refund" | "admin_adjust";
export type OrderStatus = "pending" | "paid" | "cancelled" | "expired" | "failed";
export type PaymentProvider = "wechat" | "alipay" | "manual";
export type PaymentMethod = "native" | "page" | "manual";
export type CreditPackageId = "starter" | "standard" | "pro" | "business" | "wechat_test";

export interface CreditPackage {
  id: CreditPackageId;
  name: string;
  priceCents: number;
  credits: number;
  subtitle: string;
  description?: string;
  buttonLabel?: string;
  recommended?: boolean;
}

export interface BillingPackagesResponse {
  packages: CreditPackage[];
}

export interface CreditTransactionRecord {
  id: string;
  userId: string;
  orderId?: string | null;
  taskId?: string | null;
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
  paymentUrl?: string | null;
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
  codeUrl?: string | null;
  paymentUrl?: string | null;
}

export interface PaymentOrderResponse {
  orderId: string;
  status: OrderStatus;
  packageName: string;
  amountCents: number;
  credits: number;
  codeUrl: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  currentCredits: number;
  paymentProvider: PaymentProvider;
  paymentMethod: PaymentMethod;
  outTradeNo: string;
  transactionId: string | null;
  expiredAt: string | null;
  paymentMode: "mock" | "real";
  sourceSurveySubmitted?: boolean;
}
