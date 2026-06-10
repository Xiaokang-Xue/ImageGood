"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiClient, getImageErrorMessage } from "@/lib/api-client";
import type { CreditTransactionRecord } from "@/types/billing";
import type { ImageTaskRecord } from "@/types/task";
import type { PublicUser } from "@/types/user";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tasks, setTasks] = useState<ImageTaskRecord[]>([]);
  const [transactions, setTransactions] = useState<CreditTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");

  const refreshAccount = async () => {
    const [me, taskResponse, transactionResponse] = await Promise.all([
      apiClient.me(),
      apiClient.listTasks(),
      apiClient.listCreditTransactions()
    ]);
    setUser(me.user);
    setTasks(taskResponse.tasks);
    setTransactions(transactionResponse.transactions);
  };

  useEffect(() => {
    refreshAccount()
      .catch(() => router.push("/login?redirect=/account"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await apiClient.logout().catch(() => null);
    router.push("/");
    router.refresh();
  };

  const handleResendVerification = async () => {
    setVerificationLoading(true);
    setVerificationMessage("");
    setVerificationError("");
    try {
      const response = await apiClient.resendVerificationEmail();
      setVerificationMessage(response.message);
      await refreshAccount();
      window.dispatchEvent(new CustomEvent("ai-image-credits-updated"));
    } catch (error) {
      setVerificationError(getImageErrorMessage(error));
    } finally {
      setVerificationLoading(false);
    }
  };

  const succeededTasks = useMemo(() => tasks.filter((task) => task.status === "succeeded"), [tasks]);
  const latestTask = useMemo(() => {
    return tasks
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [tasks]);

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
      <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
        <Card className="h-56 animate-pulse p-6" />
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-semibold text-studio-600">账户中心</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">账户信息与使用概览</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-studio-100 text-2xl font-bold text-studio-700">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-ink">{user.name}</h2>
              <p className="mt-1 text-sm text-muted">{user.email}</p>
            </div>
          </div>

          <div className={`mt-6 rounded-lg border p-4 ${user.emailVerified ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm font-bold ${user.emailVerified ? "text-emerald-700" : "text-amber-700"}`}>
                  {user.emailVerified ? "邮箱已验证" : "邮箱尚未验证"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {user.emailVerified
                    ? `验证时间：${user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleString("zh-CN") : "已完成"}`
                    : "完成验证后可使用图片生成和购买积分功能。"}
                </p>
              </div>
              {!user.emailVerified ? (
                <Button size="sm" loading={verificationLoading} onClick={handleResendVerification}>
                  重新发送验证邮件
                </Button>
              ) : null}
            </div>
            {verificationMessage ? <p className="mt-3 text-sm font-semibold text-emerald-700">{verificationMessage}</p> : null}
            {verificationError ? <p className="mt-3 text-sm font-semibold text-rose-700">{verificationError}</p> : null}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <InfoBlock label="当前积分余额" value={`${user.credits} 积分`} />
            <InfoBlock label="注册时间" value={new Date(user.createdAt).toLocaleDateString("zh-CN")} />
            <InfoBlock label="累计生成次数" value={`${succeededTasks.length} 次`} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <InfoBlock
              label="最近一次生成"
              value={latestTask ? new Date(latestTask.createdAt).toLocaleString("zh-CN") : "暂无记录"}
            />
            <InfoBlock
              label="最近登录时间"
              value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("zh-CN") : "暂无记录"}
            />
          </div>

          <div className="mt-8 rounded-lg border border-line bg-white p-5">
            <h2 className="text-xl font-bold text-ink">最近积分流水</h2>
            <div className="mt-4 grid gap-3">
              {transactions.slice(0, 5).length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-muted">暂无积分流水。</p>
              ) : null}
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{transaction.reason}</p>
                    <p className="mt-1 text-xs text-muted">{new Date(transaction.createdAt).toLocaleString("zh-CN")}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${transaction.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {transaction.amount > 0 ? "+" : ""}
                      {transaction.amount}
                    </p>
                    <p className="mt-1 text-xs text-muted">余额 {transaction.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-line bg-white p-5">
            <h2 className="text-xl font-bold text-ink">修改密码</h2>
            <p className="mt-2 text-sm text-muted">修改成功后当前登录状态会保留，新密码将在下次登录时生效。</p>

            {passwordError ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {passwordError}
              </div>
            ) : null}
            {passwordMessage ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {passwordMessage}
              </div>
            ) : null}

            <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={handleChangePassword}>
              <PasswordInput label="旧密码" value={oldPassword} onChange={setOldPassword} autoComplete="current-password" />
              <PasswordInput label="新密码" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
              <PasswordInput label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
              <div className="md:col-span-3">
                <Button type="submit" loading={passwordLoading}>
                  保存新密码
                </Button>
              </div>
            </form>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink">快捷操作</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/pricing">
              <Button className="w-full">购买积分</Button>
            </Link>
            <Link href="/history">
              <Button variant="outline" className="w-full">查看历史记录</Button>
            </Link>
            <Link href="/editor">
              <Button variant="outline" className="w-full">开始智能修图</Button>
            </Link>
            <Button variant="ghost" className="w-full text-rose-600 hover:bg-rose-50" onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function PasswordInput(props: {
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return <PasswordField {...props} required />;
}
