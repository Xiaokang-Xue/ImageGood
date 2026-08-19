"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lightbulb, MessageSquareWarning } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { FeedbackType } from "@/types/feedback";

const feedbackTypes = [
  { value: "suggestion" as const, label: "产品建议", description: "告诉我们怎样更好用", icon: Lightbulb },
  { value: "problem" as const, label: "问题反馈", description: "反馈功能或使用异常", icon: AlertTriangle },
  { value: "report" as const, label: "内容举报", description: "举报违规或不当内容", icon: MessageSquareWarning }
];

export default function FeedbackPage() {
  return (
    <Suspense>
      <FeedbackForm />
    </Suspense>
  );
}

function FeedbackForm() {
  const searchParams = useSearchParams();
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [taskId, setTaskId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setPageUrl(searchParams.get("from")?.slice(0, 500) || "");
    setTaskId(searchParams.get("taskId")?.slice(0, 100) || "");
    const requestedType = searchParams.get("type");
    if (requestedType === "report" || requestedType === "problem" || requestedType === "suggestion") {
      setType(requestedType);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (content.trim().length < 10) {
      setError("请至少填写 10 个字，帮助我们准确理解情况");
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.submitFeedback({
        type,
        content: content.trim(),
        contact: contact.trim() || undefined,
        pageUrl: pageUrl.trim() || undefined,
        taskId: taskId.trim() || undefined
      });
      setSuccess(response.message);
      setContent("");
      setTaskId("");
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <main className="mx-auto max-w-3xl pb-16 pt-4 sm:pt-8">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold text-neutral-500">反馈与建议</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-950 sm:text-4xl">帮助我们把 ImageGood 做得更好</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">请描述具体场景和期望结果。举报内容会进入管理员处理列表。</p>
        </header>

        <Card className="mt-7 p-5 sm:p-7">
          {success ? (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </div>
          ) : null}
          {error ? <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <fieldset>
              <legend className="text-sm font-semibold text-neutral-800">反馈类型</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {feedbackTypes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        "flex min-h-[76px] items-center gap-3 rounded-lg border px-3 py-3 text-left transition",
                        type === item.value
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-600"
                      )}
                      onClick={() => setType(item.value)}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span><span className="block text-sm font-semibold">{item.label}</span><span className={cn("mt-1 block text-xs", type === item.value ? "text-neutral-300" : "text-neutral-500")}>{item.description}</span></span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-800">具体说明</span>
              <textarea
                value={content}
                maxLength={2000}
                rows={7}
                required
                placeholder={type === "report" ? "请说明需要举报的内容、所在页面和原因" : type === "problem" ? "请说明操作步骤、实际结果和期望结果" : "请告诉我们你的使用场景和改进建议"}
                className="mt-2 w-full resize-y rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10"
                onChange={(event) => setContent(event.target.value)}
              />
              <span className="mt-1 block text-right text-xs text-neutral-400">{content.length}/2000</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="相关任务 ID（选填）" value={taskId} placeholder="可从历史记录详情复制" onChange={setTaskId} />
              <Field label="联系方式（选填）" value={contact} placeholder="手机号或邮箱" onChange={setContact} />
            </div>
            <Field label="相关页面（选填）" value={pageUrl} placeholder="例如 /editor 或页面链接" onChange={setPageUrl} />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-neutral-500">请勿提交密码、支付密钥或其他敏感凭据。</p>
              <Button type="submit" loading={loading} className="w-full sm:w-auto">提交反馈</Button>
            </div>
          </form>
        </Card>
      </main>
    </PageShell>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-800">{label}</span>
      <input
        value={value}
        maxLength={500}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
