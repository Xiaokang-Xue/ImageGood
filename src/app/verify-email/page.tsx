"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("验证链接无效或已过期，请重新发送验证邮件。");
      return;
    }

    apiClient
      .verifyEmail({ token })
      .then((response) => {
        setMessage(response.message);
        window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
      })
      .catch((requestError) => setError(getImageErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md p-7 text-center">
        <p className="text-sm font-semibold text-studio-600">邮箱验证</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">验证你的 ImageGood 账号</h1>
        <p className="mt-2 text-sm leading-6 text-muted">验证完成后即可使用图片生成和购买积分功能。</p>

        {loading ? (
          <div className="mt-6 rounded-lg border border-studio-200 bg-studio-50 px-4 py-3 text-sm font-semibold text-studio-700">
            正在验证邮箱，请稍候...
          </div>
        ) : null}
        {message ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-center gap-3">
          <Link href="/account">
            <Button variant="outline">账户中心</Button>
          </Link>
          <Link href="/editor">
            <Button>开始使用</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
