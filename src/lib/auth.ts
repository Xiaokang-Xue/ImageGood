import "server-only";
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { getDbSnapshot, withDb, type DbSmsCode, type DbUser } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createUserSession } from "@/lib/session";
import {
  EmailSendError,
  isEmailServiceConfigured,
  sendPasswordResetEmail,
  sendVerificationEmail
} from "@/lib/server/email-service";
import { sendSmsCode, SmsSendError } from "@/lib/server/sms/aliyun-sms-service";
import type { PublicUser } from "@/types/user";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const SMS_SCENES = new Set(["register", "login", "bind_phone", "change_phone"] as const);
type SmsScene = "register" | "login" | "bind_phone" | "change_phone";

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

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function assertValidPhone(phone: string) {
  if (!PHONE_PATTERN.test(phone)) {
    throw new AuthError("INVALID_PHONE", "请输入正确的手机号");
  }
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

function smsCodeHash(phone: string, scene: string, code: string) {
  const secret = process.env.AUTH_SECRET || "development-secret-change-me";
  return createHmac("sha256", secret).update(`${phone}:${scene}:${code}`).digest("hex");
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createRawToken() {
  return randomBytes(32).toString("base64url");
}

function toPublicUser(user: DbUser): PublicUser {
  const emailVerified = Boolean(user.emailVerified);
  const phoneVerified = Boolean(user.phoneVerified);
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    name: user.name,
    avatar: user.avatar ?? null,
    credits: user.credits ?? 0,
    role: user.role ?? "user",
    emailVerified,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    phoneVerified,
    phoneVerifiedAt: user.phoneVerifiedAt ?? null,
    hasVerifiedContact: emailVerified || phoneVerified,
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

function validateSmsScene(value: unknown): SmsScene {
  if (typeof value === "string" && SMS_SCENES.has(value as SmsScene)) {
    return value as SmsScene;
  }

  throw new AuthError("INVALID_SMS_SCENE", "验证码场景不正确");
}

function smsExpireMinutes() {
  const minutes = Number(process.env.SMS_CODE_EXPIRE_MINUTES || "5");
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 5;
}

function smsResendSeconds() {
  const seconds = Number(process.env.SMS_CODE_RESEND_SECONDS || "60");
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
}

function createSmsPlainCode() {
  return String(randomInt(100000, 1_000_000));
}

function userByPhone(users: DbUser[], phone: string) {
  return users.find((item) => item.phone === phone);
}

function assertSmsSendRules(input: { db: { users: DbUser[]; smsCodes: DbSmsCode[] }; phone: string; scene: SmsScene; ip?: string; userId?: string }) {
  const { db, phone, scene, ip, userId } = input;
  const user = userByPhone(db.users, phone);

  if (scene === "register" && user) {
    throw new AuthError("PHONE_ALREADY_REGISTERED", "该手机号已注册，请直接登录", 409);
  }
  if (scene === "login" && !user) {
    throw new AuthError("PHONE_NOT_REGISTERED", "该手机号未注册，请先注册", 404);
  }
  if ((scene === "bind_phone" || scene === "change_phone") && !userId) {
    throw new AuthError("UNAUTHORIZED", "请先登录", 401);
  }
  if ((scene === "bind_phone" || scene === "change_phone") && user && user.id !== userId) {
    throw new AuthError("PHONE_ALREADY_REGISTERED", "该手机号已被其他账号使用", 409);
  }

  const now = Date.now();
  const resendWindow = smsResendSeconds() * 1000;
  const hourAgo = now - 60 * 60 * 1000;
  const recentPhoneCodes = db.smsCodes.filter((item) => item.phone === phone && new Date(item.createdAt).getTime() >= hourAgo);
  const recentIpCodes = ip
    ? db.smsCodes.filter((item) => item.ip === ip && new Date(item.createdAt).getTime() >= hourAgo)
    : [];
  const latestForPhone = recentPhoneCodes
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (latestForPhone && now - new Date(latestForPhone.createdAt).getTime() < resendWindow) {
    throw new AuthError("SMS_RATE_LIMITED", "发送过于频繁，请稍后再试", 429);
  }
  if (recentPhoneCodes.length >= 5) {
    throw new AuthError("SMS_RATE_LIMITED", "该手机号验证码发送过于频繁，请稍后再试", 429);
  }
  if (recentIpCodes.length >= 20) {
    throw new AuthError("SMS_RATE_LIMITED", "验证码请求过于频繁，请稍后再试", 429);
  }
}

export async function sendPhoneSmsCode(input: unknown, options?: { userId?: string; ip?: string }) {
  const data = input as Partial<{ phone: string; scene: string }>;
  const phone = normalizePhone(String(data.phone || ""));
  const scene = validateSmsScene(data.scene);
  assertValidPhone(phone);

  const code = createSmsPlainCode();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + smsExpireMinutes() * 60 * 1000).toISOString();
  const codeId = randomUUID();

  await withDb((db) => {
    assertSmsSendRules({ db, phone, scene, ip: options?.ip, userId: options?.userId });
    db.smsCodes = db.smsCodes.map((item) =>
      item.phone === phone && item.scene === scene && !item.usedAt ? { ...item, usedAt: now } : item
    );
    db.smsCodes.push({
      id: codeId,
      phone,
      scene,
      codeHash: smsCodeHash(phone, scene, code),
      expiresAt,
      usedAt: null,
      createdAt: now,
      ip: options?.ip ?? null,
      sendStatus: "pending",
      failedAttempts: 0
    });
  });

  try {
    await sendSmsCode({ phone, code });
    await withDb((db) => {
      const record = db.smsCodes.find((item) => item.id === codeId);
      if (record) record.sendStatus = "sent";
    });
  } catch (error) {
    await withDb((db) => {
      const record = db.smsCodes.find((item) => item.id === codeId);
      if (record) record.sendStatus = "failed";
    });
    if (error instanceof SmsSendError) {
      throw new AuthError("SMS_SEND_FAILED", error.message, 503);
    }
    throw error;
  }

  return { message: "验证码已发送" };
}

function verifySmsCodeInDb(db: { smsCodes: DbSmsCode[] }, input: { phone: string; scene: SmsScene; code: string }) {
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) {
    return new AuthError("SMS_CODE_INVALID", "验证码错误");
  }
  const expectedHash = smsCodeHash(input.phone, input.scene, code);
  const usedRecord = db.smsCodes.find(
    (item) => item.phone === input.phone && item.scene === input.scene && item.usedAt && timingSafeEqualString(item.codeHash, expectedHash)
  );
  if (usedRecord) {
    return new AuthError("SMS_CODE_USED", "验证码已使用，请重新获取");
  }

  const record = db.smsCodes
    .filter((item) => item.phone === input.phone && item.scene === input.scene && !item.usedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!record) {
    return new AuthError("SMS_CODE_INVALID", "验证码错误");
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    record.usedAt = nowIso();
    return new AuthError("SMS_CODE_EXPIRED", "验证码已过期，请重新获取");
  }
  if ((record.failedAttempts ?? 0) >= 5) {
    record.usedAt = nowIso();
    return new AuthError("SMS_CODE_INVALID", "验证码错误次数过多，请重新获取");
  }

  if (!timingSafeEqualString(record.codeHash, expectedHash)) {
    record.failedAttempts = (record.failedAttempts ?? 0) + 1;
    return new AuthError("SMS_CODE_INVALID", "验证码错误");
  }

  record.usedAt = nowIso();
  return null;
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
  if (!user.email) {
    throw new AuthError("EMAIL_NOT_BOUND", "当前账号未绑定邮箱");
  }
  const token = await createEmailVerificationToken(user.id);
  const verifyUrl = buildVerifyUrl(token);
  const result = await sendVerificationEmail({ email: user.email, name: user.name }, verifyUrl);
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
      phone: null,
      phoneVerified: false,
      phoneVerifiedAt: null,
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

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
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

export async function registerPhoneUser(input: unknown) {
  const data = input as Partial<{ phone: string; code: string; name: string; password: string; confirmPassword: string }>;
  const phone = normalizePhone(String(data.phone || ""));
  const code = String(data.code || "");
  const name = String(data.name || "").trim();
  const password = String(data.password || "");
  const confirmPassword = String(data.confirmPassword || "");

  assertValidPhone(phone);
  validatePassword(password);
  if (!confirmPassword || password !== confirmPassword) {
    throw new AuthError("PASSWORD_MISMATCH", "两次输入的密码不一致");
  }
  if (!name) {
    throw new AuthError("NAME_REQUIRED", "请输入昵称");
  }
  const passwordHash = await hashPassword(password);
  const now = nowIso();
  const outcome = await withDb((db) => {
    if (userByPhone(db.users, phone)) {
      throw new AuthError("PHONE_ALREADY_REGISTERED", "该手机号已注册，请直接登录", 409);
    }

    const smsError = verifySmsCodeInDb(db, { phone, scene: "register", code });
    if (smsError) return { error: smsError };

    const created: DbUser = {
      id: randomUUID(),
      email: null,
      passwordHash,
      name,
      avatar: null,
      credits: 1,
      role: "user",
      emailVerified: false,
      emailVerifiedAt: null,
      phone,
      phoneVerified: true,
      phoneVerifiedAt: now,
      lastLoginAt: now,
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
    return { user: created };
  });

  if ("error" in outcome) {
    throw outcome.error;
  }
  const user = outcome.user;

  await createUserSession(user.id);
  return {
    user: toPublicUser(user),
    message: "注册成功，已完成手机号验证。"
  };
}

export async function loginPhoneUser(input: unknown) {
  const data = input as Partial<{ phone: string; code: string; password: string }>;
  const phone = normalizePhone(String(data.phone || ""));
  const code = String(data.code || "");
  const password = String(data.password || "");
  assertValidPhone(phone);

  if (password) {
    const db = await getDbSnapshot();
    const existing = userByPhone(db.users, phone);
    if (!existing) {
      throw new AuthError("PHONE_NOT_REGISTERED", "该手机号未注册，请先注册", 404);
    }
    if (!existing.passwordHash) {
      throw new AuthError("PASSWORD_NOT_SET", "当前账号尚未设置登录密码，请使用验证码登录");
    }
    if (!(await verifyPassword(password, existing.passwordHash))) {
      throw new AuthError("INVALID_CREDENTIALS", "手机号或密码错误", 401);
    }

    const loginAt = nowIso();
    await withDb((db) => {
      const mutableUser = userByPhone(db.users, phone);
      if (!mutableUser) return;
      mutableUser.lastLoginAt = loginAt;
      mutableUser.updatedAt = loginAt;
    });

    await createUserSession(existing.id);
    return toPublicUser({ ...existing, lastLoginAt: loginAt });
  }

  if (!code) {
    throw new AuthError("SMS_CODE_INVALID", "请输入短信验证码");
  }

  const now = nowIso();
  const outcome = await withDb((db) => {
    const existing = userByPhone(db.users, phone);
    if (!existing) {
      throw new AuthError("PHONE_NOT_REGISTERED", "该手机号未注册，请先注册", 404);
    }

    const smsError = verifySmsCodeInDb(db, { phone, scene: "login", code });
    if (smsError) return { error: smsError };
    existing.phoneVerified = true;
    existing.phoneVerifiedAt = existing.phoneVerifiedAt ?? now;
    existing.lastLoginAt = now;
    existing.updatedAt = now;
    return { user: existing };
  });

  if ("error" in outcome) {
    throw outcome.error;
  }
  const user = outcome.user;

  await createUserSession(user.id);
  return toPublicUser(user);
}

export async function bindOrChangePhone(userId: string, input: unknown) {
  const data = input as Partial<{ phone: string; code: string; scene: string }>;
  const phone = normalizePhone(String(data.phone || ""));
  const scene = validateSmsScene(data.scene || "bind_phone");
  const code = String(data.code || "");
  assertValidPhone(phone);

  if (scene !== "bind_phone" && scene !== "change_phone") {
    throw new AuthError("INVALID_SMS_SCENE", "验证码场景不正确");
  }

  const now = nowIso();
  const outcome = await withDb((db) => {
    const currentUser = db.users.find((item) => item.id === userId);
    if (!currentUser) {
      throw new AuthError("USER_NOT_FOUND", "用户不存在", 404);
    }
    const usedByOther = db.users.find((item) => item.phone === phone && item.id !== userId);
    if (usedByOther) {
      throw new AuthError("PHONE_ALREADY_REGISTERED", "该手机号已被其他账号使用", 409);
    }

    const smsError = verifySmsCodeInDb(db, { phone, scene, code });
    if (smsError) return { error: smsError };
    currentUser.phone = phone;
    currentUser.phoneVerified = true;
    currentUser.phoneVerifiedAt = now;
    currentUser.updatedAt = now;
    return { user: currentUser };
  });

  if ("error" in outcome) {
    throw outcome.error;
  }
  const user = outcome.user;

  return {
    user: toPublicUser(user),
    message: scene === "change_phone" ? "手机号已更换" : "手机号已绑定"
  };
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
  if (!user?.passwordHash) {
    throw new AuthError("PASSWORD_NOT_SET", "当前账号尚未设置登录密码，请使用短信验证码登录");
  }
  if (!(await verifyPassword(oldPassword, user.passwordHash))) {
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
    const result = await sendPasswordResetEmail({ email: user.email || email, name: user.name }, resetUrl);
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
