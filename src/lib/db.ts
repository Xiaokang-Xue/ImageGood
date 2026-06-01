import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { CreditTransactionRecord, OrderRecord } from "@/types/billing";
import type { ImageTaskRecord } from "@/types/task";

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string | null;
  credits: number;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface DbSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface DbPasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
}

interface DatabaseShape {
  users: DbUser[];
  sessions: DbSession[];
  passwordResetTokens: DbPasswordResetToken[];
  creditTransactions: CreditTransactionRecord[];
  orders: OrderRecord[];
  imageTasks: ImageTaskRecord[];
}

const EMPTY_DB: DatabaseShape = {
  users: [],
  sessions: [],
  passwordResetTokens: [],
  creditTransactions: [],
  orders: [],
  imageTasks: []
};

let writeQueue = Promise.resolve();

function resolveDbPath() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const filePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  return path.resolve(process.cwd(), filePath);
}

async function ensureDbFile() {
  const dbPath = resolveDbPath();
  await mkdir(path.dirname(dbPath), { recursive: true });

  try {
    await readFile(dbPath, "utf-8");
  } catch {
    await writeFile(dbPath, JSON.stringify(EMPTY_DB, null, 2), "utf-8");
  }
}

async function readDb(): Promise<DatabaseShape> {
  await ensureDbFile();
  const raw = await readFile(resolveDbPath(), "utf-8");
  const data = JSON.parse(raw || "{}") as Partial<DatabaseShape>;
  const now = new Date().toISOString();

  return {
    users: Array.isArray(data.users)
      ? data.users.map((user) => ({
          ...user,
          credits: typeof user.credits === "number" ? user.credits : 0,
          role: user.role === "admin" ? "admin" : "user"
        }))
      : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    passwordResetTokens: Array.isArray(data.passwordResetTokens) ? data.passwordResetTokens : [],
    creditTransactions: Array.isArray(data.creditTransactions)
      ? data.creditTransactions.map((transaction) => ({
          ...transaction,
          orderId: transaction.orderId ?? null
        }))
      : [],
    orders: Array.isArray(data.orders)
      ? data.orders.map((order, index) => {
          const legacyAmountCny = (order as unknown as { amountCny?: number }).amountCny;
          const amountCents =
            typeof order.amountCents === "number"
              ? order.amountCents
              : typeof legacyAmountCny === "number"
                ? Math.round(legacyAmountCny * 100)
                : 0;

          return {
            ...order,
            amountCents,
            status: ["pending", "paid", "cancelled", "expired", "failed"].includes(order.status)
              ? order.status
              : "pending",
            paymentProvider: order.paymentProvider === "wechat" ? "wechat" : "manual",
            paymentMethod: order.paymentMethod === "native" ? "native" : "manual",
            outTradeNo: order.outTradeNo || `LEGACY_${order.id || index}`,
            transactionId: order.transactionId ?? null,
            codeUrl: order.codeUrl ?? null,
            remark: order.remark ?? null,
            errorMessage: order.errorMessage ?? null,
            createdAt: order.createdAt || now,
            updatedAt: order.updatedAt || order.createdAt || now,
            paidAt: order.paidAt ?? null,
            expiredAt: order.expiredAt ?? null
          };
        })
      : [],
    imageTasks: Array.isArray(data.imageTasks) ? data.imageTasks : []
  };
}

async function writeDb(data: DatabaseShape) {
  await ensureDbFile();
  await writeFile(resolveDbPath(), JSON.stringify(data, null, 2), "utf-8");
}

export async function withDb<T>(mutator: (db: DatabaseShape) => T | Promise<T>) {
  const run = async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  };

  const next = writeQueue.then(run, run);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );

  return next;
}

export async function getDbSnapshot() {
  return readDb();
}

export async function initDb() {
  await ensureDbFile();
  return resolveDbPath();
}
