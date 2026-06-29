"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { apiClient, downloadImage, getImageErrorMessage } from "@/lib/api-client";
import type { ImageTaskRecord } from "@/types/task";

const typeLabels: Record<ImageTaskRecord["type"], string> = {
  edit: "智能修图",
  product: "商品图生成",
  poster: "封面海报生成",
  text_to_image: "文生图",
  remove_background: "智能抠图",
  image_enhance: "图片增强",
  object_remove: "去杂物"
};

const statusLabels: Record<ImageTaskRecord["status"], string> = {
  pending: "等待处理",
  processing: "处理中",
  succeeded: "已完成",
  failed: "生成失败"
};

export default function HistoryPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ImageTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    apiClient
      .listTasks()
      .then((response) => {
        setTasks(response.tasks);
        setSelectedIds((ids) => ids.filter((id) => response.tasks.some((task) => task.id === id)));
      })
      .catch(() => router.push("/login?redirect=/history"))
      .finally(() => setLoading(false));
  }, [router]);

  const deletableTasks = useMemo(() => tasks.filter((task) => task.status === "succeeded" || task.status === "failed"), [tasks]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allDeletableSelected = deletableTasks.length > 0 && deletableTasks.every((task) => selectedSet.has(task.id));
  const visibleTasks = useMemo(() => tasks.slice(0, visibleCount), [tasks, visibleCount]);

  const toggleSelected = (taskId: string) => {
    setMessage("");
    setError("");
    setSelectedIds((ids) => (ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId]));
  };

  const toggleSelectAll = () => {
    setMessage("");
    setError("");
    setSelectedIds(allDeletableSelected ? [] : deletableTasks.map((task) => task.id));
  };

  const removeDeletedTasks = (ids: string[]) => {
    const deletedSet = new Set(ids);
    setTasks((items) => items.filter((task) => !deletedSet.has(task.id)));
    setSelectedIds((selected) => selected.filter((id) => !deletedSet.has(id)));
  };

  const handleDeleteOne = async (task: ImageTaskRecord) => {
    if (task.status !== "succeeded" && task.status !== "failed") {
      setError("生成中的任务暂不能删除，请完成后再试");
      return;
    }
    if (!window.confirm("确定删除这条历史记录吗？删除后列表中将不再显示。")) return;

    setDeleting(true);
    setMessage("");
    setError("");
    try {
      const response = await apiClient.deleteTask(task.id);
      removeDeletedTasks([response.deletedId]);
      setMessage("历史记录已删除");
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedIds.length} 条历史记录吗？`)) return;

    setDeleting(true);
    setMessage("");
    setError("");
    try {
      const response = await apiClient.deleteTasks(selectedIds);
      removeDeletedTasks(response.deletedIds);
      if (response.skippedIds.length > 0) {
        setMessage(`已删除 ${response.deletedIds.length} 条，${response.skippedIds.length} 条生成中的记录未删除。`);
      } else {
        setMessage(`已删除 ${response.deletedIds.length} 条历史记录。`);
      }
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">历史记录</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">查看已生成的图片任务</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {tasks.length > 0 ? (
            <Button variant="outline" onClick={toggleSelectAll} disabled={deletableTasks.length === 0 || deleting}>
              {allDeletableSelected ? "取消全选" : "选择全部"}
            </Button>
          ) : null}
          {selectedIds.length > 0 ? (
            <Button variant="dark" loading={deleting} onClick={handleDeleteSelected}>
              <Trash2 className="h-4 w-4" />
              删除选中 {selectedIds.length}
            </Button>
          ) : null}
          <Link href="/editor">
            <Button>继续生成图片</Button>
          </Link>
        </div>
      </div>

      {message ? (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="h-[360px] animate-pulse p-5" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-ink">还没有生成记录</h2>
          <p className="mt-2 text-sm text-muted">完成一次图片生成后，结果会自动保存到这里。</p>
          <Link href="/editor" className="mt-5 inline-block">
            <Button>开始生成</Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleTasks.map((task) => {
            const resultImage = task.resultImages?.[0] || task.resultImageUrl || "";
            const image = resultImage || task.inputImageUrl || "";
            return (
              <Card key={task.id} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-studio-600"
                      checked={selectedSet.has(task.id)}
                      disabled={task.status !== "succeeded" && task.status !== "failed"}
                      onChange={() => toggleSelected(task.id)}
                    />
                    选择
                  </label>
                  {task.status !== "succeeded" && task.status !== "failed" ? (
                    <span className="text-xs font-semibold text-muted">处理中不可删除</span>
                  ) : null}
                </div>
                {image ? (
                  <SmartImage src={image} alt={typeLabels[task.type]} className="h-56 w-full rounded-none border-0" />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-slate-100 text-sm font-semibold text-muted">
                    {statusLabels[task.status]}
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-studio-600">{typeLabels[task.type]}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {statusLabels[task.status]}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[48px] text-sm leading-6 text-slate-600">{task.prompt}</p>
                  {task.errorMessage ? <p className="mt-3 text-sm font-semibold text-rose-600">{task.errorMessage}</p> : null}
                  <p className="mt-3 text-xs text-muted">{new Date(task.createdAt).toLocaleString("zh-CN")}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Link href={`/history/${task.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="h-4 w-4" />
                        查看结果
                      </Button>
                    </Link>
                    <Button
                      variant="dark"
                      size="sm"
                      disabled={!resultImage}
                      onClick={() => resultImage && downloadImage(resultImage)}
                    >
                      <Download className="h-4 w-4" />
                      下载图片
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleting || (task.status !== "succeeded" && task.status !== "failed")}
                      onClick={() => handleDeleteOne(task)}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          </div>
          {visibleCount < tasks.length ? (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((value) => value + 12)}>
                加载更多记录
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
