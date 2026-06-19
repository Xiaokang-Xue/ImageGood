import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { getDbSnapshot, withDb } from "@/lib/db";
import type { PublicUser } from "@/types/user";

export const SESSION_COOKIE = "ai_image_session";
const SESSION_DAYS = 30;
const COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE === "true";

function nowIso() {
  return new Date().toISOString();
}

function tokenHash(token: string) {
  const secret = process.env.AUTH_SECRET || "development-secret-change-me";
  return createHmac("sha256", secret).update(token).digest("hex");
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function publicUser(user: {
  id: string;
  email?: string | null;
  phone?: string | null;
  name: string;
  avatar?: string | null;
  credits?: number;
  role?: "user" | "admin";
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}): PublicUser {
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

export async function createUserSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await withDb((db) => {
    db.sessions.push({
      id: randomUUID(),
      userId,
      tokenHash: tokenHash(token),
      expiresAt,
      createdAt: nowIso()
    });
  });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export async function destroyUserSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;

  if (token) {
    const hash = tokenHash(token);
    await withDb((db) => {
      db.sessions = db.sessions.filter((session) => session.tokenHash !== hash);
    });
  }

  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const hash = tokenHash(token);
  const db = await getDbSnapshot();
  const session = db.sessions.find((item) => {
    const left = Buffer.from(item.tokenHash);
    const right = Buffer.from(hash);
    return left.length === right.length && timingSafeEqual(left, right);
  });

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const user = db.users.find((item) => item.id === session.userId);
  return user ? publicUser(user) : null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
