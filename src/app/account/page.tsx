"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Copy, CreditCard, History, KeyRound, LogOut, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { PhoneNumberField } from "@/components/auth/PhoneNumberField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { composePhoneNumber, isValidLocalPhone, maskPhoneNumber } from "@/config/phone-countries";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";
import { clearCurrentUserCache, getCurrentUserCached, setCurrentUserCache } from "@/lib/client-current-user";
import type { CreditTransactionRecord } from "@/types/billing";
import type { PublicUser } from "@/types/user";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [succeededTasks, setSucceededTasks] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [phonePanelOpen, setPhonePanelOpen] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState("CN");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [myInviteCode, setMyInviteCode] = useState("");
  const [inviteCouponSummary, setInviteCouponSummary] = useState({ count: 0, amountCents: 0 });
  const [inviteCopied, setInviteCopied] = useState(false);

  const refreshAccount = async () => {
    const [currentUser, taskResponse, transactionResponse] = await Promise.all([
      getCurrentUserCached(),
      apiClient.listTasks({ page: 1, limit: 1 }),
      apiClient.listCreditTransactions()
    ]);
    if (!currentUser) throw new Error("UNAUTHORIZED");
    setUser(currentUser);
    setSucceededTasks(taskResponse.summary.succeeded);
    setTransactions(transactionResponse.transactions);
  };

  useEffect(() => {
    refreshAccount().catch(() => router.push("/login?redirect=/account")).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    apiClient.getMyInvitation().then((response) => {
      setMyInviteCode(response.inviteCode);
      setInviteCouponSummary({ count: response.availableCouponCount, amountCents: response.availableCouponAmountCents });
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (phoneCountdown <= 0) return;
    const timer = window.setTimeout(() => setPhoneCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [phoneCountdown]);

  const handleLogout = async () => {
    await apiClient.logout().catch(() => null);
    clearCurrentUserCache();
    router.push("/");
    router.refresh();
  };

  const handleCopyInviteCode = async () => {
    if (!myInviteCode) return;
    try {
      await navigator.clipboard.writeText(myInviteCode);
    } catch {
      const input = document.createElement("input");
      input.value = myInviteCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 1800);
  };

  const handleResendVerification = async () => {
    setVerificationLoading(true);
    setVerificationMessage("");
    setVerificationError("");
    try {
      const response = await apiClient.resendVerificationEmail();
      setVerificationMessage(response.message);
      await refreshAccount();
    } catch (error) {
      setVerificationError(getImageErrorMessage(error));
    } finally {
      setVerificationLoading(false);
    }
  };

  const phoneScene = user?.phone ? "change_phone" : "bind_phone";
  const completePhone = composePhoneNumber(phoneCountry, phoneInput);

  const sendPhoneCode = async () => {
    setPhoneError("");
    setPhoneMessage("");
    if (!isValidLocalPhone(phoneCountry, phoneInput)) {
      setPhoneError("请输入正确的手机号");
      return;
    }
    setPhoneLoading(true);
    try {
      const response = await apiClient.sendSmsCode({ phone: completePhone, scene: phoneScene });
      setPhoneMessage(response.message || "验证码已发送");
      setPhoneCountdown(60);
    } catch (error) {
      setPhoneError(getImageErrorMessage(error));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleBindPhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPhoneError("");
    setPhoneMessage("");
    if (!isValidLocalPhone(phoneCountry, phoneInput)) {
      setPhoneError("请输入正确的手机号");
      return;
    }
    if (!phoneCode.trim()) {
      setPhoneError("请输入短信验证码");
      return;
    }
    setPhoneLoading(true);
    try {
      const response = await apiClient.bindPhone({ phone: completePhone, code: phoneCode, scene: phoneScene });
      setPhoneMessage(response.message || "手机号已更新");
      setPhoneInput("");
      setPhoneCode("");
      setPhoneCountdown(0);
      setCurrentUserCache(response.user);
      setUser(response.user);
      setPhonePanelOpen(false);
      await refreshAccount();
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (error) {
      setPhoneError(getImageErrorMessage(error));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordError("");
    setPasswordMessage("");
    if (!oldPassword) {
      setPasswordError("请输入旧密码");
      setPasswordLoading(false);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("新密码至少需要 8 位");
      setPasswordLoading(false);
      return;
    }
    if (oldPassword === newPassword) {
      setPasswordError("新密码不能和旧密码相同");
      setPasswordLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的新密码不一致");
      setPasswordLoading(false);
      return;
    }
    try {
      const response = await apiClient.changePassword({ oldPassword, newPassword });
      setPasswordMessage(response.message);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(getImageErrorMessage(error));
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <div className="h-8 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="h-80 animate-pulse" />
          <Card className="h-64 animate-pulse" />
        </div>
      </main>
    );
  }
  if (!user) return null;

  const benefitLabel = user.membershipUnlimited
    ? user.membershipPlan || "不限次权益"
    : user.credits > 0 ? `${user.credits} 张图片可用` : "暂无可用额度";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
      <header className="flex flex-col gap-5 border-b border-neutral-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">账户中心</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">你好，{user.name}</h1>
          <p className="mt-2 text-sm text-neutral-500">管理创作权益、联系方式与账户安全。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/history" className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-950 hover:bg-neutral-50"><History className="h-4 w-4" />历史记录</Link>
          <Link href="/pricing" className="inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white transition hover:bg-neutral-800"><CreditCard className="h-4 w-4" />购买方案</Link>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-6">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xl font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-neutral-950">{user.name}</h2>
                  <p className="mt-1 truncate text-sm text-neutral-500">{user.email || (user.phone ? maskPhoneNumber(user.phone) : "ImageGood 用户")}</p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />{user.hasVerifiedContact ? "联系方式已验证" : "待验证"}</span>
            </div>
            <div className="grid border-t border-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-neutral-200">
              <AccountMetric label="当前创作权益" value={benefitLabel} />
              <AccountMetric label="累计生成" value={`${succeededTasks} 次`} />
              <AccountMetric label="注册时间" value={new Date(user.createdAt).toLocaleDateString("zh-CN")} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-neutral-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-neutral-950">账户与安全</h2>
              <p className="mt-1 text-sm text-neutral-500">仅在需要时展开并修改安全信息。</p>
            </div>
            <SecurityRow icon={<Smartphone className="h-5 w-5" />} title="手机号" detail={user.phone ? maskPhoneNumber(user.phone) : undefined} status={user.phoneVerified ? "已验证" : undefined} actionLabel={user.phone ? "更换手机号" : "绑定手机号"} onAction={() => { setPhonePanelOpen((value) => !value); setPhoneError(""); setPhoneMessage(""); }} />
            {phonePanelOpen ? (
              <form className="border-b border-neutral-200 bg-neutral-50 px-6 py-5" onSubmit={handleBindPhone}>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <PhoneNumberField countryCode={phoneCountry} value={phoneInput} onCountryChange={(countryCode) => { setPhoneCountry(countryCode); setPhoneInput(""); }} onChange={setPhoneInput} label={user.phone ? "新手机号" : "手机号"} required />
                  <label className="block">
                    <span className="text-sm font-semibold text-neutral-800">短信验证码</span>
                    <input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6 位验证码" className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10" />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" loading={phoneLoading} disabled={phoneCountdown > 0} onClick={sendPhoneCode}>{phoneCountdown > 0 ? `${phoneCountdown} 秒后重发` : "发送验证码"}</Button>
                  <Button type="submit" loading={phoneLoading}>{user.phone ? "确认更换" : "确认绑定"}</Button>
                  <Button type="button" variant="ghost" onClick={() => setPhonePanelOpen(false)}>取消</Button>
                </div>
                {phoneMessage ? <p className="mt-3 text-sm font-medium text-emerald-700">{phoneMessage}</p> : null}
                {phoneError ? <p className="mt-3 text-sm font-medium text-rose-700">{phoneError}</p> : null}
              </form>
            ) : null}
            <SecurityRow icon={<Mail className="h-5 w-5" />} title="邮箱" detail={user.email || "未绑定"} status={user.emailVerified ? "已验证" : user.email ? "待验证" : undefined} actionLabel={user.email && !user.emailVerified ? "发送验证邮件" : undefined} actionLoading={verificationLoading} onAction={user.email && !user.emailVerified ? handleResendVerification : undefined} />
            {verificationMessage || verificationError ? <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-3 text-sm font-medium"><span className={verificationError ? "text-rose-700" : "text-emerald-700"}>{verificationError || verificationMessage}</span></div> : null}
            <SecurityRow icon={<KeyRound className="h-5 w-5" />} title="登录密码" detail="用于手机号或邮箱密码登录" actionLabel="修改密码" onAction={() => { setPasswordPanelOpen((value) => !value); setPasswordError(""); setPasswordMessage(""); }} last />
            {passwordPanelOpen ? (
              <form className="border-t border-neutral-200 bg-neutral-50 px-6 py-5" onSubmit={handleChangePassword}>
                <div className="grid gap-4 md:grid-cols-3">
                  <PasswordField label="旧密码" value={oldPassword} onChange={setOldPassword} autoComplete="current-password" required />
                  <PasswordField label="新密码" value={newPassword} onChange={setNewPassword} autoComplete="new-password" required />
                  <PasswordField label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2"><Button type="submit" loading={passwordLoading}>保存新密码</Button><Button type="button" variant="ghost" onClick={() => setPasswordPanelOpen(false)}>取消</Button></div>
                {passwordMessage ? <p className="mt-3 text-sm font-medium text-emerald-700">{passwordMessage}</p> : null}
                {passwordError ? <p className="mt-3 text-sm font-medium text-rose-700">{passwordError}</p> : null}
              </form>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-neutral-200 px-6 py-5"><h2 className="text-lg font-semibold text-neutral-950">最近权益记录</h2><p className="mt-1 text-sm text-neutral-500">展示最近 5 条额度变化。</p></div>
            <div className="divide-y divide-neutral-200">
              {transactions.slice(0, 5).length === 0 ? <p className="px-6 py-8 text-center text-sm text-neutral-500">暂无权益记录</p> : null}
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-neutral-900">{transaction.reason}</p><p className="mt-1 text-xs text-neutral-500">{new Date(transaction.createdAt).toLocaleString("zh-CN")}</p></div>
                  <p className={`shrink-0 text-sm font-semibold ${transaction.amount >= 0 ? "text-emerald-700" : "text-neutral-900"}`}>{transaction.amount === 0 ? "已生效" : `${transaction.amount > 0 ? "+" : ""}${transaction.amount}`}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="grid content-start gap-6">
          <Card className="overflow-hidden border-neutral-950 bg-neutral-950 p-6 text-white shadow-none">
            <p className="text-sm font-medium text-neutral-400">我的邀请码</p>
            <p className="mt-3 text-3xl font-semibold tracking-[0.16em]">{myInviteCode || "生成中…"}</p>
            <p className="mt-3 text-sm leading-6 text-neutral-400">好友注册时填写，双方各得一张 ¥10 优惠券。</p>
            {inviteCouponSummary.count > 0 ? <p className="mt-3 text-xs font-medium text-emerald-300">可用邀请券 {inviteCouponSummary.count} 张，共 ¥{(inviteCouponSummary.amountCents / 100).toFixed(0)}</p> : null}
            <Button type="button" variant="outline" className="mt-5 w-full border-neutral-700 text-white hover:border-neutral-500 hover:bg-neutral-900" disabled={!myInviteCode} onClick={handleCopyInviteCode}>{inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{inviteCopied ? "已复制" : "复制邀请码"}</Button>
          </Card>
          <Card className="p-6">
            <p className="text-sm font-medium text-neutral-500">当前权益</p>
            <p className="mt-2 text-xl font-semibold text-neutral-950">{benefitLabel}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">{user.membershipUnlimited ? user.membershipLifetime ? "长期有效" : user.membershipExpiresAt ? `${new Date(user.membershipExpiresAt).toLocaleDateString("zh-CN")} 到期` : "权益有效" : "图片额度长期有效"}</p>
            <Link href="/pricing" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-neutral-950 hover:underline">查看可用方案 <ArrowRight className="h-4 w-4" /></Link>
          </Card>
          <button type="button" onClick={handleLogout} className="inline-flex h-11 items-center justify-center gap-2 rounded-md text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-rose-700"><LogOut className="h-4 w-4" />退出登录</button>
        </aside>
      </div>
    </main>
  );
}

function AccountMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-neutral-200 px-6 py-5 first:border-t-0 sm:border-t-0"><p className="text-xs font-medium text-neutral-500">{label}</p><p className="mt-1.5 text-base font-semibold text-neutral-950">{value}</p></div>;
}

function SecurityRow({ icon, title, detail, status, actionLabel, actionLoading, onAction, last }: { icon: React.ReactNode; title: string; detail?: string; status?: string; actionLabel?: string; actionLoading?: boolean; onAction?: () => void; last?: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-6 py-5 ${last ? "" : "border-b border-neutral-200"}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">{icon}</div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-neutral-950">{title}</p>{status ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">{status}</span> : null}</div>{detail ? <p className="mt-1 truncate text-sm text-neutral-500">{detail}</p> : null}</div>
      {actionLabel && onAction ? <Button type="button" size="sm" variant="outline" loading={actionLoading} onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
