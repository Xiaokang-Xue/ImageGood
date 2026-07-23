"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, X, XCircle } from "lucide-react";
import {
  apiClient,
  forgetTrackedImageTask,
  getTrackedImageTasks,
  ImageApiClientError,
  isUnauthorizedError
} from "@/lib/api-client";

type CompletionNotice = {
  kind: "succeeded" | "failed";
  message: string;
};

export function ActiveImageTaskMonitor() {
  const [activeCount, setActiveCount] = useState(0);
  const [notice, setNotice] = useState<CompletionNotice | null>(null);
  const checking = useRef(false);

  const checkTasks = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;

    try {
      const tracked = getTrackedImageTasks();
      setActiveCount(tracked.length);

      for (const item of tracked) {
        try {
          const response = await apiClient.getTask(item.id);
          if (response.task.status === "succeeded") {
            forgetTrackedImageTask(item.id);
            setNotice({ kind: "succeeded", message: "图片已生成，可在历史记录中查看结果。" });
          } else if (response.task.status === "failed") {
            forgetTrackedImageTask(item.id);
            setNotice({ kind: "failed", message: "图片任务未完成，本次不会扣除积分。" });
          }
        } catch (error) {
          if (isUnauthorizedError(error)) {
            forgetTrackedImageTask(item.id);
          } else if (
            error instanceof ImageApiClientError &&
            error.code === "TASK_NOT_FOUND" &&
            Date.now() - item.createdAt > 2 * 60 * 1000
          ) {
            forgetTrackedImageTask(item.id);
          }
        }
      }

      setActiveCount(getTrackedImageTasks().length);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void checkTasks();
    const timer = window.setInterval(() => void checkTasks(), 6000);
    const handleUpdate = () => void checkTasks();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkTasks();
    };
    window.addEventListener("imagegood-active-tasks-updated", handleUpdate);
    window.addEventListener("online", handleUpdate);
    window.addEventListener("pageshow", handleUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("imagegood-active-tasks-updated", handleUpdate);
      window.removeEventListener("online", handleUpdate);
      window.removeEventListener("pageshow", handleUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkTasks]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice && activeCount === 0) return null;

  return (
    <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-xl border border-slate-300 bg-white p-4 shadow-lg md:bottom-5 md:right-5">
      <div className="flex items-start gap-3">
        {notice?.kind === "succeeded" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : notice?.kind === "failed" ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        ) : (
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-950">
            {notice ? (notice.kind === "succeeded" ? "生成完成" : "任务未完成") : "图片任务正在后台生成"}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {notice?.message || `页面刷新或短暂断网不会丢失任务${activeCount > 1 ? `，当前共 ${activeCount} 个任务` : ""}。`}
          </p>
          <Link href="/history" className="mt-2 inline-flex text-sm font-semibold text-slate-950 underline underline-offset-4">
            查看历史记录
          </Link>
        </div>
        {notice ? (
          <button type="button" aria-label="关闭提示" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
