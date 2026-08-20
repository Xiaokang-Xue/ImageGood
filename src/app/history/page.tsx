"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Heart,
  Pencil,
  SlidersHorizontal,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  apiClient,
  downloadImage,
  getImageErrorMessage,
  isUnauthorizedError
} from "@/lib/api-client";
import {
  getHistoryTaskEditorTool,
  getHistoryTaskResult,
  getHistoryTaskTitle,
  historyTaskStatusLabels,
  historyTaskTypeLabels
} from "@/lib/history-task";
import { useStudioStore } from "@/lib/studio-store";
import { trialDownloadLabel } from "@/lib/trial-image";
import { cn } from "@/lib/utils";
import type {
  ImageTaskRecord,
  ImageTaskStatus,
  ImageTaskTimeRange,
  ImageTaskType
} from "@/types/task";

type TaskFilters = {
  type: ImageTaskType | "all";
  status: ImageTaskStatus | "all";
  timeRange: ImageTaskTimeRange;
  favorite: boolean;
};

const initialFilters: TaskFilters = {
  type: "all",
  status: "all",
  timeRange: "all",
  favorite: false
};

export default function HistoryPage() {
  const router = useRouter();
  const setUploadedImage = useStudioStore((state) => state.setUploadedImage);
  const setPrompt = useStudioStore((state) => state.setPrompt);
  const setSelectedTool = useStudioStore((state) => state.setSelectedTool);
  const [tasks, setTasks] = useState<ImageTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(initialFilters);
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [savingId, setSavingId] = useState("");
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setMessage("");
    apiClient
      .listTasks({ page: 1, limit: 12, ...filters })
      .then((response) => {
        if (sequence !== requestSequence.current) return;
        setTasks(response.tasks);
        setPage(response.page);
        setTotal(response.total);
        setHasMore(response.hasMore);
        setSelectedIds([]);
      })
      .catch((requestError) => {
        if (sequence !== requestSequence.current) return;
        if (isUnauthorizedError(requestError)) {
          router.push("/login?redirect=/history");
          return;
        }
        setError(getImageErrorMessage(requestError));
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });
  }, [filters, router]);

  const deletableTasks = useMemo(
    () => tasks.filter((task) => task.status === "succeeded" || task.status === "failed"),
    [tasks]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allDeletableSelected =
    deletableTasks.length > 0 && deletableTasks.every((task) => selectedSet.has(task.id));
  const hasActiveFilters =
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.timeRange !== "all" ||
    filters.favorite;

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    const sequence = requestSequence.current;
    setLoadingMore(true);
    setError("");
    try {
      const response = await apiClient.listTasks({ page: page + 1, limit: 12, ...filters });
      if (sequence !== requestSequence.current) return;
      setTasks((items) => {
        const existingIds = new Set(items.map((task) => task.id));
        return [...items, ...response.tasks.filter((task) => !existingIds.has(task.id))];
      });
      setPage(response.page);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (requestError) {
      if (sequence !== requestSequence.current) return;
      setError(getImageErrorMessage(requestError));
    } finally {
      if (sequence === requestSequence.current) setLoadingMore(false);
    }
  };

  const updateFilter = <Key extends keyof TaskFilters>(key: Key, value: TaskFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleSelected = (taskId: string) => {
    setMessage("");
    setError("");
    setSelectedIds((ids) =>
      ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId]
    );
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
    setTotal((value) => Math.max(0, value - ids.length));
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
      setMessage(
        response.skippedIds.length > 0
          ? `已删除 ${response.deletedIds.length} 条，${response.skippedIds.length} 条生成中的记录未删除。`
          : `已删除 ${response.deletedIds.length} 条历史记录。`
      );
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  };

  const handleFavorite = async (task: ImageTaskRecord) => {
    const nextFavorite = !task.isFavorite;
    setSavingId(task.id);
    setError("");
    try {
      const response = await apiClient.updateTask(task.id, { isFavorite: nextFavorite });
      setTasks((items) =>
        filters.favorite && !response.task.isFavorite
          ? items.filter((item) => item.id !== task.id)
          : items.map((item) => (item.id === task.id ? response.task : item))
      );
      if (filters.favorite && !response.task.isFavorite) setTotal((value) => Math.max(0, value - 1));
      setMessage(response.task.isFavorite ? "已收藏该任务" : "已取消收藏");
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setSavingId("");
    }
  };

  const startRename = (task: ImageTaskRecord) => {
    setRenamingId(task.id);
    setRenameValue(getHistoryTaskTitle(task));
    setMessage("");
    setError("");
  };

  const saveRename = async (task: ImageTaskRecord) => {
    const title = renameValue.trim();
    if (!title) {
      setError("请输入任务名称");
      return;
    }
    setSavingId(task.id);
    setError("");
    try {
      const response = await apiClient.updateTask(task.id, { title });
      setTasks((items) => items.map((item) => (item.id === task.id ? response.task : item)));
      setRenamingId("");
      setMessage("任务名称已保存");
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setSavingId("");
    }
  };

  const openEditorWithTask = (task: ImageTaskRecord) => {
    const resultImage = getHistoryTaskResult(task);
    const sourceImage = resultImage || task.inputImageUrl;
    if (!sourceImage) {
      setError("该任务没有可复用的输入图片");
      return;
    }
    setUploadedImage(sourceImage, null);
    setPrompt(task.prompt);
    setSelectedTool(getHistoryTaskEditorTool(task));
    router.push("/editor");
  };

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">历史记录</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">管理你的图片任务</h1>
          <p className="mt-2 text-sm text-muted">共 {total} 条记录，按创建时间从近到远排列。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tasks.length > 0 ? (
            <Button variant="outline" onClick={toggleSelectAll} disabled={!deletableTasks.length || deleting}>
              {allDeletableSelected ? "取消全选" : "选择全部"}
            </Button>
          ) : null}
          {selectedIds.length > 0 ? (
            <Button variant="dark" loading={deleting} onClick={handleDeleteSelected}>
              <Trash2 className="h-4 w-4" />
              删除选中 {selectedIds.length}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal className="h-4 w-4" />
          筛选任务
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_auto]">
          <FilterSelect
            label="任务类型"
            value={filters.type}
            onChange={(value) => updateFilter("type", value as TaskFilters["type"])}
            options={[
              ["all", "全部类型"],
              ...Object.entries(historyTaskTypeLabels)
            ]}
          />
          <FilterSelect
            label="生成状态"
            value={filters.status}
            onChange={(value) => updateFilter("status", value as TaskFilters["status"])}
            options={[
              ["all", "全部状态"],
              ...Object.entries(historyTaskStatusLabels)
            ]}
          />
          <FilterSelect
            label="创建时间"
            value={filters.timeRange}
            onChange={(value) => updateFilter("timeRange", value as ImageTaskTimeRange)}
            options={[
              ["all", "全部时间"],
              ["today", "今天"],
              ["7d", "近 7 天"],
              ["30d", "近 30 天"]
            ]}
          />
          <div className="flex flex-col">
            <span aria-hidden="true" className="hidden text-xs font-semibold text-neutral-500 sm:block">
              收藏筛选
            </span>
            <button
              type="button"
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition sm:mt-1.5",
                filters.favorite
                  ? "border-neutral-900 bg-neutral-950 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
              )}
              onClick={() => updateFilter("favorite", !filters.favorite)}
            >
              <Heart className={cn("h-4 w-4", filters.favorite && "fill-current")} />
              仅看收藏
            </button>
          </div>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
            onClick={() => setFilters(initialFilters)}
          >
            清除筛选
          </button>
        ) : null}
      </Card>

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
            <Card key={item} className="h-[440px] animate-pulse p-5" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-ink">{hasActiveFilters ? "没有符合条件的任务" : "还没有生成记录"}</h2>
          <p className="mt-2 text-sm text-muted">
            {hasActiveFilters ? "调整筛选条件后再试。" : "完成一次图片生成后，结果会自动保存到这里。"}
          </p>
          {hasActiveFilters ? (
            <Button className="mt-5" variant="outline" onClick={() => setFilters(initialFilters)}>
              清除筛选
            </Button>
          ) : (
            <Link href="/editor" className="mt-5 inline-block">
              <Button>开始生成</Button>
            </Link>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tasks.map((task, index) => {
              const resultImage = getHistoryTaskResult(task);
              const image =
                task.resultImagePreviewUrl ||
                task.resultImagePreviewUrls?.[0] ||
                resultImage ||
                task.inputImagePreviewUrl ||
                task.inputImageUrl ||
                "";
              const canDelete = task.status === "succeeded" || task.status === "failed";
              return (
                <Card key={task.id} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-studio-600"
                        checked={selectedSet.has(task.id)}
                        disabled={!canDelete}
                        onChange={() => toggleSelected(task.id)}
                      />
                      选择
                    </label>
                    <button
                      type="button"
                      className={cn(
                        "rounded-md p-2 transition hover:bg-neutral-100",
                        task.isFavorite ? "text-rose-600" : "text-neutral-400 hover:text-neutral-900"
                      )}
                      aria-label={task.isFavorite ? "取消收藏" : "收藏任务"}
                      disabled={savingId === task.id}
                      onClick={() => void handleFavorite(task)}
                    >
                      <Heart className={cn("h-5 w-5", task.isFavorite && "fill-current")} />
                    </button>
                  </div>
                  {image ? (
                    <SmartImage
                      src={image}
                      fallbackSrc={resultImage || task.inputImageUrl || undefined}
                      alt={getHistoryTaskTitle(task)}
                      priority={index < 2}
                      previewWidth={false}
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="h-56 w-full rounded-none border-0"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center bg-slate-100 text-sm font-semibold text-muted">
                      {historyTaskStatusLabels[task.status]}
                    </div>
                  )}
                  <div className="p-5">
                    {renamingId === task.id ? (
                      <div className="flex gap-2">
                        <input
                          value={renameValue}
                          maxLength={60}
                          autoFocus
                          className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveRename(task);
                            if (event.key === "Escape") setRenamingId("");
                          }}
                        />
                        <Button size="sm" loading={savingId === task.id} onClick={() => void saveRename(task)}>
                          保存
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold text-ink">{getHistoryTaskTitle(task)}</h2>
                          <p className="mt-1 text-xs font-semibold text-studio-600">{historyTaskTypeLabels[task.type]}</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                          aria-label="重命名任务"
                          onClick={() => startRename(task)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {historyTaskStatusLabels[task.status]}
                      </span>
                      <time className="text-xs text-muted">
                        {new Date(task.createdAt).toLocaleString("zh-CN", { hour12: false })}
                      </time>
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-[48px] text-sm leading-6 text-slate-600">{task.prompt}</p>
                    {task.errorMessage ? (
                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-rose-600">{task.errorMessage}</p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link href={`/history/${task.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          <ExternalLink className="h-4 w-4" />
                          查看
                        </Button>
                      </Link>
                      <Button
                        variant="dark"
                        size="sm"
                        disabled={!resultImage}
                        onClick={() => openEditorWithTask(task)}
                      >
                        继续编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!resultImage}
                        onClick={() => resultImage && downloadImage(resultImage)}
                      >
                        <Download className="h-4 w-4" />
                        {trialDownloadLabel(resultImage, "下载")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                        disabled={deleting || !canDelete}
                        onClick={() => void handleDeleteOne(task)}
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
          {hasMore ? (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" loading={loadingMore} onClick={loadMore}>
                加载更多记录
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-500">{label}</span>
      <select
        value={value}
        className="mt-1.5 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-900"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
