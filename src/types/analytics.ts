export type AnalyticsEventType = "page_view";

export interface AnalyticsEventRecord {
  id: string;
  type: AnalyticsEventType;
  path: string;
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
  registrations: number;
  paidOrders: number;
  revenueCents: number;
  succeededTasks: number;
}

export interface AnalyticsTopPage {
  path: string;
  views: number;
  uniqueVisitors: number;
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
    revenueCents: number;
    todayRevenueCents: number;
    creditsConsumed: number;
  };
  daily: AnalyticsDailyPoint[];
  topPages: AnalyticsTopPage[];
  recentPaidOrders: Array<{
    id: string;
    packageName: string;
    amountCents: number;
    credits: number;
    userEmail: string;
    paidAt: string;
  }>;
}
