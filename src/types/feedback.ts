export type FeedbackType = "suggestion" | "report" | "problem";
export type FeedbackStatus = "pending" | "reviewing" | "resolved" | "closed";

export interface FeedbackRecord {
  id: string;
  userId?: string | null;
  type: FeedbackType;
  content: string;
  contact?: string | null;
  pageUrl?: string | null;
  taskId?: string | null;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeedbackRecord extends FeedbackRecord {
  userAccount: string | null;
  userName: string | null;
}

export interface AdminFeedbackPage {
  feedback: AdminFeedbackRecord[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
