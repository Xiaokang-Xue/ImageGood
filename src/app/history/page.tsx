"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { apiClient, downloadImage } from "@/lib/api-client";
import type { ImageTaskRecord } from "@/types/task";

const typeLabels: Record<ImageTaskRecord["type"], string> = {
  edit: "智能修图",
  product: "商品图生成",
  poster: "封面海报生成"
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

  useEffect(() => {
    apiClient
      .listTasks()
      .then((response) => setTasks(response.tasks))
      .catch(() => router.push("/login?redirect=/history"))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-studio-600">历史记录</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">查看已生成的图片任务</h1>
        </div>
        <Link href="/editor">
          <Button>继续生成图片</Button>
        </Link>
      </div>

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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const resultImage = task.resultImages?.[0] || task.resultImageUrl || "";
            const image = resultImage || task.inputImageUrl || "";
            return (
              <Card key={task.id} className="overflow-hidden">
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
                  <div className="mt-4 grid grid-cols-2 gap-2">
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
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
