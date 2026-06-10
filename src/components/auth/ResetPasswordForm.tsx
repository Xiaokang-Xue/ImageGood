"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";

export function ResetPasswordForm({ tokenFromPath = "" }: { tokenFromPath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryToken = searchParams.get("token") || "";
  const [hashToken, setHashToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (tokenFromPath || queryToken || typeof window === "undefined") return;

    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    setHashToken(hashParams.get("token") || hash);
  }, [queryToken, tokenFromPath]);

  const token = useMemo(() => {
    return decodeURIComponent(tokenFromPath || queryToken || hashToken || "").trim();
  }, [hashToken, queryToken, tokenFromPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("密码至少需要 8 位");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.resetPassword({ token, password, confirmPassword });
      setMessage(response.message);
      setTimeout(() => router.push("/login"), 1000);
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md p-7">
        <p className="text-sm font-semibold text-studio-600">重置密码</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">设置新的登录密码</h1>
        <p className="mt-2 text-sm leading-6 text-muted">重置链接有效期为 30 分钟，使用后会立即失效，并清除旧登录状态。</p>

        {!token ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            重置链接无效，请重新生成。
          </div>
        ) : null}
        {error ? <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        {message ? <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div> : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <PasswordField label="新密码" value={password} onChange={setPassword} autoComplete="new-password" required />
          <PasswordField label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required />
          <Button type="submit" size="lg" loading={loading} disabled={!token} className="w-full">
            重置密码
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          返回{" "}
          <Link href="/login" className="font-semibold text-studio-700">
            登录页面
          </Link>
        </p>
      </Card>
    </main>
  );
}
