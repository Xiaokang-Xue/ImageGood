import "server-only";
import { createHmac, randomBytes, randomUUID } from "crypto";
import { getDbSnapshot, withDb, type DbUser } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createUserSession } from "@/lib/session";
import {
  EmailSendError,
  isEmailServiceConfigured,
  sendPasswordResetEmail,
  sendVerificationEmail
} from "@/lib/server/email-service";
import type { PublicUser } from "@/types/user";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function tokenExpireMinutes(envName: string) {
  const minutes = Number(process.env[envName] || "30");
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
}

function tokenHash(token: string) {
  const secret = process.env.AUTH_SECRET || "development-secret-change-me";
  return createHmac("sha256", secret).update(token).digest("hex");
}

function createRawToken() {
  return randomBytes(32).toString("base64url");
}

function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar ?? null,
    credits: user.credits ?? 0,
    role: user.role ?? "user",
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt
  };
}

function validatePassword(password: string, code = "WEAK_PASSWORD") {
  if (password.length < 8) {
    throw new AuthError(code, "密码至少需要 8 位");
  }
}

export function validateRegisterInput(input: unknown) {
  const data = input as Partial<{ email: string; password: string; confirmPassword: string; name: string }>;
  const email = normalizeEmail(String(data.email || ""));
  const password = String(data.password || "");
  const confirmPassword = String(data.confirmPassword || "");
  const name = String(data.name || "").trim();

  if (!name) {
    throw new AuthError("NAME_REQUIRED", "请输入昵称");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new AuthError("INVALID_EMAIL", "请输入有效的邮箱地址");
  }

  validatePassword(password);

  if (!confirmPassword || password !== confirmPassword) {
    throw new AuthError("PASSWORD_MISMATCH", "两次输入的密码不一致");
  }

  return { email, password, name };
}

export function validateLoginInput(input: unknown) {
  const data = input as Partial<{ email: string; password: string }>;
  const email = normalizeEmail(String(data.email || ""));
  const password = String(data.password || "");

  if (!EMAIL_PATTERN.test(email) || !password) {
    throw new AuthError("INVALID_CREDENTIALS", "邮箱或密码错误", 401);
  }

  return { email, password };
}

async function createEmailVerificationToken(userId: string) {
  const rawToken = createRawToken();
  const now = nowIso();
  const expiresAt = new Date(
    Date.now() + tokenExpireMinutes("EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES") * 60 * 1000
  ).toISOString();

  await withDb((db) => {
    db.emailVerificationTokens = db.emailVerificationTokens.map((item) =>
      item.userId === userId && !item.usedAt ? { ...item, usedAt: now } : item
    );
    db.emailVerificationTokens.push({
      id: randomUUID(),
      userId,
      tokenHash: tokenHash(rawToken),
      expiresAt,
      usedAt: null,
      createdAt: now
    });
  });

  return rawToken;
}

function buildVerifyUrl(token: string) {
  return `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildResetUrl(token: string) {
  return `${appUrl()}/reset-password/${encodeURIComponent(token)}`;
}

async function sendUserVerificationEmail(user: DbUser) {
  const token = await createEmailVerificationToken(user.id);
  const verifyUrl = buildVerifyUrl(token);
  const result = await sendVerificationEmail(user, verifyUrl);
  if (result.devLogged) {
    console.info(`[auth] 邮箱验证链接：${verifyUrl}`);
  }
  return result;
}

export async function registerUser(input: unknown) {
  const { email, password, name } = validateRegisterInput(input);
  const now = nowIso();
  const passwordHash = await hashPassword(password);

  const user = await withDb((db) => {
    if (db.users.some((item) => item.email === email)) {
      throw new AuthError("EMAIL_EXISTS", "该邮箱已注册", 409);
    }

    const created: DbUser = {
      id: randomUUID(),
      email,
      passwordHash,
      name,
      avatar: null,
      credits: 1,
      role: "user",
      emailVerified: false,
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    };

    db.users.push(created);
    db.creditTransactions.push({
      id: randomUUID(),
      userId: created.id,
      orderId: null,
      taskId: null,
      type: "grant",
      amount: 1,
      balanceAfter: 1,
      reason: "新用户免费体验额度",
      createdAt: now
    });
    return created;
  });

  await createUserSession(user.id);

  try {
    await sendUserVerificationEmail(user);
    return {
      user: toPublicUser(user),
      message: "注册成功，请前往邮箱完成验证。",
      verificationEmailSent: true
    };
  } catch (error) {
    console.error("[auth] verification email failed", {
      userId: user.id,
      email: user.email,
      message: error instanceof Error ? error.message : String(error)
    });
    return {
      user: toPublicUser(user),
      message: "账号已创建，但验证邮件发送失败，请稍后在账户中心重新发送。",
      verificationEmailSent: false
    };
  }
}

export async function loginUser(input: unknown) {
  const { email, password } = validateLoginInput(input);
  const db = await getDbSnapshot();
  const user = db.users.find((item) => item.email === email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AuthError("INVALID_CREDENTIALS", "邮箱或密码错误", 401);
  }

  const loginAt = nowIso();
  await withDb((mutableDb) => {
    const mutableUser = mutableDb.users.find((item) => item.id === user.id);
    if (!mutableUser) return;
    mutableUser.lastLoginAt = loginAt;
    mutableUser.updatedAt = loginAt;
  });

  await createUserSession(user.id);
  return toPublicUser({ ...user, lastLoginAt: loginAt });
}

export async function changePassword(userId: string, input: unknown) {
  const data = input as Partial<{ oldPassword: string; newPassword: string }>;
  const oldPassword = String(data.oldPassword || "");
  const newPassword = String(data.newPassword || "");

  if (!oldPassword) {
    throw new AuthError("OLD_PASSWORD_REQUIRED", "请输入旧密码");
  }
  validatePassword(newPassword);

  const db = await getDbSnapshot();
  const user = db.users.find((item) => item.id === userId);
  if (!user || !(await verifyPassword(oldPassword, user.passwordHash))) {
    throw new AuthError("INVALID_OLD_PASSWORD", "旧密码不正确", 401);
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new AuthError("PASSWORD_UNCHANGED", "新密码不能和旧密码相同");
  }

  const passwordHash = await hashPassword(newPassword);
  await withDb((mutableDb) => {
    const mutableUser = mutableDb.users.find((item) => item.id === userId);
    if (!mutableUser) return;
    mutableUser.passwordHash = passwordHash;
    mutableUser.updatedAt = nowIso();
  });
}

export async function verifyEmailToken(input: unknown) {
  const token = String((input as Partial<{ token: string }>)?.token || "");
  if (!token) {
    throw new AuthError("VERIFY_TOKEN_REQUIRED", "验证链接无效或已过期，请重新发送验证邮件。", 400);
  }

  const hash = tokenHash(token);
  const now = nowIso();

  await withDb((db) => {
    const record = db.emailVerificationTokens.find((item) => item.tokenHash === hash);
    if (!record || record.usedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new AuthError("VERIFY_TOKEN_INVALID", "验证链接无效或已过期，请重新发送验证邮件。", 400);
    }

    const user = db.users.find((item) => item.id === record.userId);
    if (!user) {
      throw new AuthError("VERIFY_TOKEN_INVALID", "验证链接无效或已过期，请重新发送验证邮件。", 400);
    }

    user.emailVerified = true;
    user.emailVerifiedAt = now;
    user.updatedAt = now;
    record.usedAt = now;
  });
}

export async function resendVerificationEmail(userId: string) {
  const db = await getDbSnapshot();
  const user = db.users.find((item) => item.id === userId);
  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "用户不存在", 404);
  }

  if (user.emailVerified) {
    return { message: "邮箱已验证", emailVerified: true };
  }

  const latestToken = db.emailVerificationTokens
    .filter((item) => item.userId === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (latestToken && Date.now() - new Date(latestToken.createdAt).getTime() < 60_000) {
    throw new AuthError("RESEND_TOO_SOON", "请 60 秒后再重新发送验证邮件", 429);
  }

  await sendUserVerificationEmail(user);
  return { message: "验证邮件已发送，请前往邮箱查收。", emailVerified: false };
}

function assertEmailCanSendForPasswordReset() {
  if (process.env.NODE_ENV === "production" && !isEmailServiceConfigured()) {
    throw new AuthError("EMAIL_NOT_CONFIGURED", "邮件服务未配置完整，暂时无法发送密码重置邮件", 503);
  }
}

export async function requestPasswordResetEmail(emailInput: unknown) {
  const email = normalizeEmail(String(emailInput || ""));
  const genericMessage = "如果该邮箱已注册，我们会发送密码重置邮件。";

  if (!EMAIL_PATTERN.test(email)) {
    return { message: genericMessage };
  }

  assertEmailCanSendForPasswordReset();

  const db = await getDbSnapshot();
  const user = db.users.find((item) => item.email === email);
  if (!user) {
    console.info(`[auth] password reset requested for unknown email: ${email}`);
    return { message: genericMessage };
  }

  const rawToken = createRawToken();
  const now = nowIso();
  const expiresAt = new Date(
    Date.now() + tokenExpireMinutes("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES") * 60 * 1000
  ).toISOString();

  await withDb((mutableDb) => {
    mutableDb.passwordResetTokens = mutableDb.passwordResetTokens.map((item) =>
      item.userId === user.id && !item.usedAt ? { ...item, usedAt: now } : item
    );
    mutableDb.passwordResetTokens.push({
      id: randomUUID(),
      userId: user.id,
      tokenHash: tokenHash(rawToken),
      expiresAt,
      usedAt: null,
      createdAt: now
    });
  });

  const resetUrl = buildResetUrl(rawToken);
  try {
    const result = await sendPasswordResetEmail(user, resetUrl);
    if (result.devLogged) {
      console.info(`[auth] 密码重置链接：${resetUrl}`);
    }
  } catch (error) {
    if (error instanceof EmailSendError) {
      throw new AuthError("EMAIL_SEND_FAILED", error.message, 503);
    }
    throw error;
  }

  return { message: genericMessage };
}

export async function resetPassword(input: unknown) {
  const data = input as Partial<{ token: string; password: string; confirmPassword: string; newPassword: string }>;
  const token = String(data.token || "");
  const password = String(data.password || data.newPassword || "");
  const confirmPassword = String(data.confirmPassword || "");

  if (!token) {
    throw new AuthError("RESET_TOKEN_REQUIRED", "重置链接无效或已过期", 400);
  }
  validatePassword(password);
  if (!confirmPassword || password !== confirmPassword) {
    throw new AuthError("PASSWORD_MISMATCH", "两次输入的密码不一致");
  }

  const hash = tokenHash(token);
  const passwordHash = await hashPassword(password);
  const now = nowIso();

  await withDb((db) => {
    const resetRecord = db.passwordResetTokens.find((item) => item.tokenHash === hash);
    if (!resetRecord || resetRecord.usedAt || new Date(resetRecord.expiresAt).getTime() <= Date.now()) {
      throw new AuthError("RESET_TOKEN_INVALID", "重置链接无效或已过期", 400);
    }

    const user = db.users.find((item) => item.id === resetRecord.userId);
    if (!user) {
      throw new AuthError("RESET_TOKEN_INVALID", "重置链接无效或已过期", 400);
    }

    user.passwordHash = passwordHash;
    user.updatedAt = now;
    resetRecord.usedAt = now;
    db.sessions = db.sessions.filter((session) => session.userId !== user.id);
  });
}
