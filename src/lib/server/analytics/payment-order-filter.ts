interface AnalyticsOrder {
  id: string;
  transactionId?: string | null;
}

interface AnalyticsCreditTransaction {
  orderId?: string | null;
  type: string;
}

function adminAdjustedOrderIds(transactions: AnalyticsCreditTransaction[]) {
  return new Set(
    transactions
      .filter((transaction) => transaction.type === "admin_adjust" && transaction.orderId)
      .map((transaction) => String(transaction.orderId))
  );
}

export function customerPaymentOrders<T extends AnalyticsOrder>(
  orders: T[],
  transactions: AnalyticsCreditTransaction[]
) {
  const adjustedOrderIds = adminAdjustedOrderIds(transactions);
  return orders.filter(
    (order) =>
      !adjustedOrderIds.has(order.id) &&
      !String(order.transactionId || "").startsWith("ADMIN_ADJUST_")
  );
}
