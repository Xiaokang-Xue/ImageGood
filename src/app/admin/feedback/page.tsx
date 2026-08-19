"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageApiClientError, apiClient, getImageErrorMessage, isUnauthorizedError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AdminFeedbackRecord, FeedbackStatus, FeedbackType } from "@/types/feedback";

const PAGE_SIZE = 12;
const typeLabels: Record<FeedbackType, string> = { suggestion: "产品建议", problem: "问题反馈", report: "内容举报" };
const statusLabels: Record<FeedbackStatus, string> = { pending: "待处理", reviewing: "处理中", resolved: "已解决", closed: "已关闭" };
const typeIcons = { suggestion: Lightbulb, problem: AlertTriangle, report: MessageSquareWarning };

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<AdminFeedbackRecord[]>([]);
  const [type, setType] = useState<FeedbackType | "all">("all");
  const [status, setStatus] = useState<FeedbackStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  const loadFeedback = useCallback(() => {
    setLoading(true);
    setError("");
    apiClient.listAdminFeedback({ page, limit: PAGE_SIZE, type, status })
      .then((response) => {
        setFeedback(response.feedback);
        setTotal(response.total);
      })
      .catch((requestError) => {
        if (isUnauthorizedError(requestError)) return setError("请先登录管理员账号");
        if (requestError instanceof ImageApiClientError && requestError.code === "FORBIDDEN") return setError("无权限访问");
        setError(getImageErrorMessage(requestError));
      })
      .finally(() => setLoading(false));
  }, [page, status, type]);

  useEffect(() => loadFeedback(), [loadFeedback]);

  const updateStatus = async (id: string, nextStatus: FeedbackStatus) => {
    setUpdatingId(id);
    setError("");
    try {
      await apiClient.updateFeedbackStatus(id, nextStatus);
      loadFeedback();
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setUpdatingId("");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">管理员</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">反馈与建议</h1>
          <p className="mt-3 text-sm text-muted">查看用户提交的建议、功能问题和内容举报，并记录处理状态。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/analytics"><Button variant="outline">运营数据</Button></Link>
          <Link href="/admin/orders"><Button variant="outline">支付订单</Button></Link>
          <Link href="/admin/tasks"><Button variant="outline">图片任务</Button></Link>
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={type} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none focus:border-neutral-950" onChange={(event) => { setPage(1); setType(event.target.value as FeedbackType | "all"); }}>
            <option value="all">全部类型</option>
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={status} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none focus:border-neutral-950" onChange={(event) => { setPage(1); setStatus(event.target.value as FeedbackStatus | "all"); }}>
            <option value="all">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </Card>

      {error ? <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? <Card className="p-8 text-center text-sm text-muted">反馈加载中…</Card> : null}
      {!loading && feedback.length === 0 ? <Card className="p-8 text-center text-sm text-muted">当前筛选条件下暂无反馈</Card> : null}

      {!loading && feedback.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {feedback.map((entry) => {
            const Icon = typeIcons[entry.type];
            return (
              <Card key={entry.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50"><Icon className="h-4 w-4" /></span>
                    <div><p className="text-sm font-bold text-neutral-950">{typeLabels[entry.type]}</p><p className="mt-0.5 text-xs text-neutral-500">{new Date(entry.createdAt).toLocaleString("zh-CN")}</p></div>
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", entry.status === "pending" ? "border-amber-200 bg-amber-50 text-amber-800" : entry.status === "resolved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-neutral-200 bg-neutral-50 text-neutral-700")}>{statusLabels[entry.status]}</span>
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">{entry.content}</p>
                <dl className="mt-4 grid gap-1.5 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
                  <p>提交用户：{entry.userName ? `${entry.userName}（${entry.userAccount || entry.userId}）` : entry.userAccount || "匿名用户"}</p>
                  {entry.contact ? <p>联系方式：{entry.contact}</p> : null}
                  {entry.taskId ? <p className="break-all">任务 ID：{entry.taskId}</p> : null}
                  {entry.pageUrl ? <p className="break-all">相关页面：{entry.pageUrl}</p> : null}
                  <p className="break-all">反馈 ID：{entry.id}</p>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["reviewing", "resolved", "closed"] as FeedbackStatus[]).map((nextStatus) => (
                    <Button key={nextStatus} size="sm" variant={entry.status === nextStatus ? "secondary" : "outline"} disabled={entry.status === nextStatus} loading={updatingId === entry.id} onClick={() => void updateStatus(entry.id, nextStatus)}>{statusLabels[nextStatus]}</Button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</Button>
          <span className="text-sm text-muted">第 {page} / {totalPages} 页，共 {total} 条</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</Button>
        </div>
      ) : null}
    </main>
  );
}
