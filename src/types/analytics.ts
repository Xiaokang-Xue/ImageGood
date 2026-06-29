export type AnalyticsEventType = "page_view" | "purchase_click" | "acquisition_channel";

export interface AnalyticsEventRecord {
  id: string;
  type: AnalyticsEventType;
  path: string;
  target?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
  referrer?: string | null;
  visitorId: string;
  sessionId: string;
  userId?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AnalyticsMetric {
  label: string;
  value: number;
  helper?: string;
}

export interface AnalyticsDailyPoint {
  date: string;
  pageViews: number;
  purchaseClicks: number;
  registrations: number;
  paidOrders: number;
  revenueCents: number;
  succeededTasks: number;
}

export interface AnalyticsTopPage {
  path: string;
  label: string;
  views: number;
  uniqueVisitors: number;
}

export interface AnalyticsChannelPoint {
  channel: string;
  count: number;
}

export interface AnalyticsTaskTypePoint {
  type: string;
  label: string;
  total: number;
  succeeded: number;
}

export interface AdminAnalyticsResponse {
  overview: {
    totalPageViews: number;
    todayPageViews: number;
    uniqueVisitors: number;
    totalUsers: number;
    todayRegistrations: number;
    verifiedUsers: number;
    totalTasks: number;
    succeededTasks: number;
    failedTasks: number;
    paidOrders: number;
    pendingOrders: number;
    pendingOrderUsers: number;
    purchaseClicks: number;
    purchaseClickUsers: number;
    pricingPageViews: number;
    pricingVisitors: number;
    checkoutPageViews: number;
    checkoutVisitors: number;
    generationPageVisitors: number;
    activeUsers7d: number;
    todayActiveUsers: number;
    revenueCents: number;
    todayRevenueCents: number;
    creditsConsumed: number;
  };
  daily: AnalyticsDailyPoint[];
  topPages: AnalyticsTopPage[];
  acquisitionChannels: AnalyticsChannelPoint[];
  taskTypes: AnalyticsTaskTypePoint[];
  recentPaidOrders: Array<{
    id: string;
    packageName: string;
    amountCents: number;
    credits: number;
    userEmail: string;
    paidAt: string;
  }>;
}
