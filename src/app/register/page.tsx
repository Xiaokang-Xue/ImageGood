"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshCaptcha = async () => {
    const response = await apiClient.captcha();
    setCaptchaQuestion(response.question);
    setCaptchaAnswer("");
  };

  useEffect(() => {
    refreshCaptcha().catch(() => setError("验证码加载失败，请刷新页面重试"));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("请输入昵称");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }
    if (!confirmPassword) {
      setError("请再次输入密码");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.register({ name, email, password, confirmPassword, captchaAnswer });
      setMessage(response.message || "注册成功，请前往邮箱完成验证。");
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
      refreshCaptcha().catch(() => null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md p-7">
        <p className="text-sm font-semibold text-studio-600">创建账号</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">开始使用 ImageGood</h1>
        <p className="mt-2 text-sm leading-6 text-muted">注册后可保存生成记录。完成邮箱验证后即可使用图片生成和购买积分功能。</p>

        {error ? <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        {message ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/account" className="underline">
                前往账户中心
              </Link>
              <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="underline">
                去登录
              </Link>
            </div>
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">昵称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">邮箱</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
            />
          </label>
          <PasswordField
            label="密码"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            helper="至少 8 位字符"
            required
          />
          <PasswordField
            label="确认密码"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            required
          />
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">验证码</span>
            <div className="mt-2 grid grid-cols-[1fr_120px] gap-2">
              <div className="flex h-11 items-center rounded-lg border border-line bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                {captchaQuestion || "加载中..."}
              </div>
              <input
                value={captchaAnswer}
                onChange={(event) => setCaptchaAnswer(event.target.value)}
                inputMode="numeric"
                required
                className="h-11 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
              />
            </div>
            <button type="button" className="mt-2 text-xs font-semibold text-studio-700" onClick={refreshCaptcha}>
              换一道题
            </button>
          </label>
          <Button type="submit" size="lg" loading={loading} className="w-full">
            注册
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          已有账号？{" "}
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-semibold text-studio-700">
            去登录
          </Link>
        </p>
      </Card>
    </main>
  );
}
