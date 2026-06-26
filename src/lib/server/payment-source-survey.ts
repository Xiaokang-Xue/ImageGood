import "server-only";
import { getDbSnapshot } from "@/lib/db";
import { PaymentSourceSurveyRequiredError } from "@/lib/server/auth-guards";
import type { AnalyticsEventRecord } from "@/types/analytics";
import type { OrderRecord } from "@/types/billing";

function surveyEventMatchesOrder(event: AnalyticsEventRecord, userId: string, orderId: string) {
  if (event.type !== "acquisition_channel") return false;
  if (event.userId !== userId) return false;
  return String(event.metadata?.orderId || "") === orderId;
}

export function hasPaymentSourceSurvey(events: AnalyticsEventRecord[], userId: string, orderId: string) {
  return events.some((event) => surveyEventMatchesOrder(event, userId, orderId));
}

export async function findMissingPaymentSourceSurveyOrder(userId: string): Promise<OrderRecord | null> {
  const db = await getDbSnapshot({ includeAnalytics: true });
  const paidOrders = db.orders
    .filter((order) => order.userId === userId && order.status === "paid" && (order.paymentProvider === "wechat" || order.paymentProvider === "alipay"))
    .sort((left, right) => new Date(right.paidAt || right.updatedAt).getTime() - new Date(left.paidAt || left.updatedAt).getTime());

  return paidOrders.find((order) => !hasPaymentSourceSurvey(db.analyticsEvents, userId, order.id)) ?? null;
}

export async function assertPaymentSourceSurveyCompleted(userId: string) {
  const missingOrder = await findMissingPaymentSourceSurveyOrder(userId);
  if (missingOrder) {
    throw new PaymentSourceSurveyRequiredError(missingOrder.id);
  }
}
