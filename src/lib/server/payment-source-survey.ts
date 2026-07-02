import "server-only";
import { findMissingPaymentSourceSurveyOrderRecord } from "@/lib/db";
import { PaymentSourceSurveyRequiredError } from "@/lib/server/auth-guards";
import type { OrderRecord } from "@/types/billing";

export async function findMissingPaymentSourceSurveyOrder(userId: string): Promise<OrderRecord | null> {
  return findMissingPaymentSourceSurveyOrderRecord(userId);
}

export async function assertPaymentSourceSurveyCompleted(userId: string) {
  const missingOrder = await findMissingPaymentSourceSurveyOrder(userId);
  if (missingOrder) {
    throw new PaymentSourceSurveyRequiredError(missingOrder.id);
  }
}
