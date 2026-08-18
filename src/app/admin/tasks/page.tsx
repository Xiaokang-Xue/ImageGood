"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  ImageApiClientError,
  apiClient,
  getImageErrorMessage,
  isUnauthorizedError
} from "@/lib/api-client";
import {
  historyTaskStatusLabels,
  historyTaskTypeLabels
} from "@/lib/history-task";
import type {
  AdminImageTaskRecord,
  ImageTaskStatus,
  ImageTaskType
} from "@/types/task";

const PAGE_SIZE = 10;

function firstResult(task: AdminImageTaskRecord) {
  return task.resultImages?.[0] || task.resultImageUrl || "";
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<AdminImageTaskRecord[]>([]);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ImageTaskType | "all">("all");
  const [status, setStatus] = useState<ImageTaskStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTasks = useCallback(() => {
    setLoading(true);
    setError("");

    apiClient
      .listAdminImageTasks({
        page,
        limit: PAGE_SIZE,
        query,
        type,
        status
      })
      .then((response) => {
        setTasks(response.tasks);
        setTotal(response.total);
      })
      .catch((requestError) => {
        if (isUnauthorizedError(requestError)) {
          setError("请先登录管理员账号");
          return;
        }
        if (
          requestError instanceof ImageApiClientError &&
          requestError.code === "FORBIDDEN"
        ) {
          setError("无权限访问");
          return;
        }
        setError(getImageErrorMessage(requestError) || "任务查询失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [page, query, status, type]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setQuery(queryDraft.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">管理员</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">图片任务查询</h1>
          <p className="mt-3 text-sm text-muted">
            按账号、手机号、用户 ID 或任务 ID 查找输入、生成需求和结果。此页面仅提供只读查询。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/analytics">
            <Button variant="outline">运营数据</Button>
          </Link>
          <Link href="/admin/orders">
            <Button variant="outline">支付订单</Button>
          </Link>
          <Link href="/admin/feedback">
            <Button variant="outline">用户反馈</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6 p-4">
        <form className="flex flex-col gap-3 lg:flex-row" onSubmit={submitSearch}>
          <label className="min-w-0 flex-1">
            <span className="sr-only">搜索图片任务</span>
            <div className="flex h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 focus-within:border-neutral-900">
              <Search className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                value={queryDraft}
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                placeholder="输入邮箱、手机号、用户 ID 或任务 ID"
                onChange={(event) => setQueryDraft(event.target.value)}
              />
            </div>
          </label>
          <select
            value={type}
            className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none focus:border-neutral-900"
            onChange={(event) => {
              setPage(1);
              setType(event.target.value as ImageTaskType | "all");
            }}
          >
            <option value="all">全部类型</option>
            {Object.entries(historyTaskTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={status}
            className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none focus:border-neutral-900"
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as ImageTaskStatus | "all");
            }}
          >
            <option value="all">全部状态</option>
            {Object.entries(historyTaskStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit" className="lg:min-w-24">
            查询
          </Button>
        </form>
      </Card>

      {error ? (
        <Card className="mb-5 border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          {error}
        </Card>
      ) : null}

      {!error ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>共 {total} 条任务</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={safePage <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              上一页
            </Button>
            <span className="font-semibold text-neutral-700">
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={safePage >= totalPages || loading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="h-72 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : !error && tasks.length === 0 ? (
        <Card className="p-10 text-center text-sm font-semibold text-muted">
          没有找到符合条件的图片任务。
        </Card>
      ) : !error ? (
        <div className="grid gap-4">
          {tasks.map((task) => {
            const resultImage = firstResult(task);
            return (
              <Card key={task.id} className="p-5">
                <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                    {task.inputImageUrl ? (
                      <ImageBlock label="输入图片" src={task.inputImageUrl} />
                    ) : null}
                    {resultImage ? (
                      <ImageBlock label="生成结果" src={resultImage} />
                    ) : null}
                    {!task.inputImageUrl && !resultImage ? (
                      <div className="flex min-h-32 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 text-xs text-neutral-500">
                        暂无图片
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">
                        {historyTaskTypeLabels[task.type]}
                      </span>
                      <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700">
                        {historyTaskStatusLabels[task.status]}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {formatTime(task.createdAt)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-1 text-sm text-neutral-600">
                      <p>
                        <span className="font-semibold text-neutral-900">用户：</span>
                        {task.userAccount}
                        {task.userName ? `（${task.userName}）` : ""}
                      </p>
                      <p className="break-all">
                        <span className="font-semibold text-neutral-900">用户 ID：</span>
                        {task.userId}
                      </p>
                      <p className="break-all">
                        <span className="font-semibold text-neutral-900">任务 ID：</span>
                        {task.id}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-900">积分状态：</span>
                        {task.creditCharged ? "已扣积分" : "未扣积分"}
                      </p>
                    </div>

                    <div className="mt-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3">
                      <p className="text-xs font-semibold text-neutral-500">生成需求</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">
                        {task.prompt || "未记录生成需求"}
                      </p>
                    </div>

                    {task.errorMessage ? (
                      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {task.errorMessage}
                      </div>
                    ) : null}

                    {task.originalResultImages?.length ? (
                      <a
                        href={`/api/tasks/${encodeURIComponent(task.id)}/download?inline=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
                      >
                        查看无水印结果
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}

function ImageBlock({ label, src }: { label: string; src: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-500">{label}</span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-neutral-700 hover:text-neutral-950"
        >
          原图
        </a>
      </div>
      <SmartImage
        src={src}
        alt={label}
        ratio="4:3"
        previewWidth={480}
        imageClassName="object-contain"
      />
    </div>
  );
}
