"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await apiClient.login({ email, password, captchaAnswer });
      if (!response.user.emailVerified) {
        setMessage("你的邮箱尚未验证，完成验证后可使用图片生成和购买功能。");
        window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
        setTimeout(() => router.push("/account"), 700);
        return;
      }
      router.push(redirect);
      router.refresh();
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
        <p className="text-sm font-semibold text-studio-600">登录账号</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">继续使用 ImageGood</h1>
        <p className="mt-2 text-sm leading-6 text-muted">登录后可生成图片、保存结果并查看历史记录。</p>

        {error ? <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        {message ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            {message}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
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
            autoComplete="current-password"
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
            登录
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-4 text-sm">
          <Link href="/forgot-password" className="font-semibold text-studio-700">
            忘记密码
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-muted">
            还没有账号？{" "}
            <Link href={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-semibold text-studio-700">
              立即注册
            </Link>
          </span>
        </div>
      </Card>
    </main>
  );
}
