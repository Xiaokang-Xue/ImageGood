"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";
import { setCurrentUserCache } from "@/lib/client-current-user";

type LoginMode = "phone" | "email";
type PhoneLoginMethod = "code" | "password";

function isValidPhone(phone: string) {
  return /^1[3-9]\d{9}$/.test(phone.trim());
}

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
  const [mode, setMode] = useState<LoginMode>("phone");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [phoneLoginMethod, setPhoneLoginMethod] = useState<PhoneLoginMethod>("code");
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [smsLoading, setSmsLoading] = useState(false);
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
    refreshCaptcha().catch(() => null);
  }, []);

  useEffect(() => {
    if (smsCountdown <= 0) return;
    const timer = window.setTimeout(() => setSmsCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [smsCountdown]);

  const sendSms = async () => {
    setError("");
    setMessage("");
    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号");
      return;
    }

    setSmsLoading(true);
    try {
      const response = await apiClient.sendSmsCode({ phone, scene: "login" });
      setMessage(response.message || "验证码已发送");
      setSmsCountdown(60);
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setSmsLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (phoneLoginMethod === "password") {
      if (!phonePassword) {
        setError("请输入密码");
        return;
      }
      const response = await apiClient.loginPhone({ phone, password: phonePassword });
      setCurrentUserCache(response.user);
      router.push(redirect);
      router.refresh();
      return response;
    }

    if (!smsCode.trim()) {
      setError("请输入短信验证码");
      return;
    }

    const response = await apiClient.loginPhone({ phone, code: smsCode });
    setCurrentUserCache(response.user);
    router.push(redirect);
    router.refresh();
    return response;
  };

  const handleEmailLogin = async () => {
    const response = await apiClient.login({ email, password, captchaAnswer });
    setCurrentUserCache(response.user);
    if (!response.user.hasVerifiedContact) {
      setMessage("你的邮箱尚未验证，也未绑定已验证手机号。完成任一验证后可使用图片生成和购买功能。");
      setTimeout(() => router.push("/account"), 700);
      return response;
    }
    router.push(redirect);
    router.refresh();
    return response;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "phone") {
        await handlePhoneLogin();
      } else {
        await handleEmailLogin();
      }
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
      if (mode === "email") refreshCaptcha().catch(() => null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md p-7">
        <p className="text-sm font-semibold text-studio-600">登录账号</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">继续使用 ImageGood</h1>
        <p className="mt-2 text-sm leading-6 text-muted">手机号支持验证码或密码登录，也可以切换为邮箱登录。</p>

        <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          {(["phone", "email"] as LoginMode[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                mode === item ? "bg-white text-studio-700 shadow-sm" : "text-slate-500"
              }`}
              onClick={() => {
                setMode(item);
                setError("");
                setMessage("");
              }}
            >
              {item === "phone" ? "手机号登录" : "邮箱登录"}
            </button>
          ))}
        </div>

        {error ? <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        {message ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            {message}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          {mode === "phone" ? (
            <>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">手机号</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
                />
              </label>
              <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                {(["code", "password"] as PhoneLoginMethod[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                      phoneLoginMethod === item ? "bg-white text-studio-700 shadow-sm" : "text-slate-500"
                    }`}
                    onClick={() => {
                      setPhoneLoginMethod(item);
                      setError("");
                      setMessage("");
                    }}
                  >
                    {item === "code" ? "验证码登录" : "密码登录"}
                  </button>
                ))}
              </div>
              {phoneLoginMethod === "code" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">短信验证码</span>
                  <div className="mt-2 grid grid-cols-[1fr_128px] gap-2">
                    <input
                      value={smsCode}
                      onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      required
                      className="h-11 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none transition focus:border-studio-400 focus:ring-4 focus:ring-studio-500/10"
                    />
                    <Button type="button" variant="outline" disabled={smsCountdown > 0} loading={smsLoading} onClick={sendSms}>
                      {smsCountdown > 0 ? `${smsCountdown}s` : "发送验证码"}
                    </Button>
                  </div>
                </label>
              ) : (
                <PasswordField label="密码" value={phonePassword} onChange={setPhonePassword} autoComplete="current-password" required />
              )}
            </>
          ) : (
            <>
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
              <PasswordField label="密码" value={password} onChange={setPassword} autoComplete="current-password" required />
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
            </>
          )}
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
