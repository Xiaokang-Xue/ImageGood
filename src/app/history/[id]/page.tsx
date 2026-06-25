"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { apiClient, downloadImage, getImageErrorMessage, isUnauthorizedError } from "@/lib/api-client";
import type { ImageTaskRecord } from "@/types/task";

const typeLabels: Record<ImageTaskRecord["type"], string> = {
  edit: "智能修图",
  product: "商品图生成",
  poster: "封面海报生成",
  text_to_image: "文生图",
  remove_background: "智能抠图"
};

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<ImageTaskRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiClient
      .getTask(params.id)
      .then((response) => setTask(response.task))
      .catch((requestError) => {
        if (isUnauthorizedError(requestError)) {
          setError("请先登录后再查看历史记录");
          return;
        }
        setError(getImageErrorMessage(requestError) || "记录不存在或暂时无法访问");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1200px] px-5 py-10">
        <Card className="h-[520px] animate-pulse p-6" />
      </main>
    );
  }

  if (error || !task) {
    return (
      <main className="mx-auto max-w-[900px] px-5 py-10">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-ink">无法打开生成结果</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
            {error || "记录不存在或已被删除。你可以返回历史记录页重新选择。"}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/history">
              <Button variant="outline">返回历史记录</Button>
            </Link>
            {error.includes("登录") ? (
              <Link href="/login?redirect=/history">
                <Button>去登录</Button>
              </Link>
            ) : null}
          </div>
        </Card>
      </main>
    );
  }

  const images = task.resultImages?.length ? task.resultImages : task.resultImageUrl ? [task.resultImageUrl] : [];
  const canDelete = task.status === "succeeded" || task.status === "failed";

  const handleDelete = async () => {
    if (!canDelete) {
      setActionError("生成中的任务暂不能删除，请完成后再试");
      return;
    }
    if (!window.confirm("确定删除这条历史记录吗？删除后列表中将不再显示。")) return;

    setDeleting(true);
    setActionError("");
    try {
      await apiClient.deleteTask(task.id);
      router.push("/history");
    } catch (requestError) {
      setActionError(getImageErrorMessage(requestError));
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">{typeLabels[task.type]}</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">生成结果详情</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" loading={deleting} disabled={!canDelete} onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            删除记录
          </Button>
          <Link href="/history">
            <Button variant="outline">返回历史记录</Button>
          </Link>
        </div>
      </div>

      {actionError ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {actionError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5">
          {images.length > 0 ? (
            <div className="grid gap-4">
              {images.map((image, index) => (
                <div key={image} className="overflow-hidden rounded-lg border border-line bg-white">
                  <SmartImage
                    src={image}
                    alt={`生成结果 ${index + 1}`}
                    className="h-[720px] max-h-[72vh] min-h-[420px] w-full rounded-none border-0 bg-slate-50"
                    imageClassName="object-contain"
                  />
                  <div className="p-4">
                    <Button variant="dark" className="w-full" onClick={() => downloadImage(image)}>
                      <Download className="h-4 w-4" />
                      下载图片
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-muted">
              {task.errorMessage || "生成结果暂不可用"}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink">任务信息</h2>
          <Info label="状态" value={task.status === "succeeded" ? "已完成" : task.status === "failed" ? "生成失败" : "处理中"} />
          <Info label="创建时间" value={new Date(task.createdAt).toLocaleString("zh-CN")} />
          <Info label="生成需求" value={task.prompt} />
          {task.errorMessage ? <Info label="失败原因" value={task.errorMessage} /> : null}
        </Card>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}
