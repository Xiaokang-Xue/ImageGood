"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";

type RegisterMode = "phone" | "email";

function isValidPhone(phone: string) {
  return /^1[3-9]\d{9}$/.test(phone.trim());
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [mode, setMode] = useState<RegisterMode>("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [smsLoading, setSmsLoading] = useState(false);
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
      const response = await apiClient.sendSmsCode({ phone, scene: "register" });
      setMessage(response.message || "验证码已发送");
      setSmsCountdown(60);
    } catch (requestError) {
      setError(getImageErrorMessage(requestError));
    } finally {
      setSmsLoading(false);
    }
  };

  const validateShared = () => {
    if (!name.trim()) {
      setError("请输入昵称");
      return false;
    }
    return true;
  };

  const validateRequiredPassword = () => {
    if (!password) {
      setError("请输入密码");
      return false;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 位");
      return false;
    }
    if (!confirmPassword) {
      setError("请再次输入密码");
      return false;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return false;
    }
    return true;
  };

  const handlePhoneRegister = async () => {
    if (!validateShared()) return;
    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (!smsCode.trim()) {
      setError("请输入短信验证码");
      return;
    }
    if (!validateRequiredPassword()) return;

    const response = await apiClient.registerPhone({
      name,
      phone,
      code: smsCode,
      password,
      confirmPassword
    });
    setMessage(response.message || "注册成功");
    window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    setTimeout(() => {
      router.push(redirect);
      router.refresh();
    }, 500);
  };

  const handleEmailRegister = async () => {
    if (!validateShared()) return;
    if (!password) {
      setError("请输入密码");
      return;
    }
    if (!validateRequiredPassword()) return;

    const response = await apiClient.register({ name, email, password, confirmPassword, captchaAnswer });
    setMessage(response.message || "注册成功，请前往邮箱完成验证。");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "phone") {
        await handlePhoneRegister();
      } else {
        await handleEmailRegister();
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
        <p className="text-sm font-semibold text-studio-600">创建账号</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">开始使用 ImageGood</h1>
        <p className="mt-2 text-sm leading-6 text-muted">推荐使用手机号注册，邮箱注册入口继续保留。</p>

        <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          {(["phone", "email"] as RegisterMode[]).map((item) => (
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
              {item === "phone" ? "手机号注册" : "邮箱注册"}
            </button>
          ))}
        </div>

        {error ? <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        {message ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
            {mode === "email" ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href="/account" className="underline">
                  前往账户中心
                </Link>
                <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="underline">
                  去登录
                </Link>
              </div>
            ) : null}
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
              <PasswordField label="设置密码" value={password} onChange={setPassword} autoComplete="new-password" helper="至少 8 位字符" required />
              <PasswordField label="确认密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required />
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
              <PasswordField label="密码" value={password} onChange={setPassword} autoComplete="new-password" helper="至少 8 位字符" required />
              <PasswordField label="确认密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required />
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
