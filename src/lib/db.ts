import "server-only";
import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { AnalyticsEventRecord } from "@/types/analytics";
import type { CreditTransactionRecord, OrderRecord } from "@/types/billing";
import type { ImageTaskRecord } from "@/types/task";

const ANALYTICS_EVENT_TYPES = new Set(["page_view", "purchase_click"]);

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string | null;
  credits: number;
  role: "user" | "admin";
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
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

export interface DbEmailVerificationToken {
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
  emailVerificationTokens: DbEmailVerificationToken[];
  passwordResetTokens: DbPasswordResetToken[];
  creditTransactions: CreditTransactionRecord[];
  orders: OrderRecord[];
  imageTasks: ImageTaskRecord[];
  analyticsEvents: AnalyticsEventRecord[];
}

type DbCollectionName = keyof DatabaseShape;

const COLLECTIONS: DbCollectionName[] = [
  "users",
  "sessions",
  "emailVerificationTokens",
  "passwordResetTokens",
  "creditTransactions",
  "orders",
  "imageTasks",
  "analyticsEvents"
];

const EMPTY_DB: DatabaseShape = {
  users: [],
  sessions: [],
  emailVerificationTokens: [],
  passwordResetTokens: [],
  creditTransactions: [],
  orders: [],
  imageTasks: [],
  analyticsEvents: []
};

let writeQueue = Promise.resolve();
let mysqlPoolPromise: Promise<unknown> | null = null;
let mysqlSchemaReady = false;
const MYSQL_WRITE_RETRIES = 3;

interface MysqlRecordState {
  collection: DbCollectionName;
  id: string;
  json: string;
  dbHash: string | null;
}

interface MysqlSnapshot {
  data: DatabaseShape;
  states: Map<string, MysqlRecordState>;
}

interface MysqlChange {
  collection: DbCollectionName;
  id: string;
  json: string;
  hash: string;
  previous?: MysqlRecordState;
}

interface MysqlDelete {
  collection: DbCollectionName;
  id: string;
  previous: MysqlRecordState;
}

class MysqlWriteConflictError extends Error {
  constructor() {
    super("MySQL write conflict, retrying transaction");
    this.name = "MysqlWriteConflictError";
  }
}

function databaseUrl() {
  return process.env.DATABASE_URL || "file:./dev.db";
}

function isMysqlDatabaseUrl(value = databaseUrl()) {
  return /^mysql2?:\/\//i.test(value);
}

function resolveDbPath() {
  const value = databaseUrl();
  const filePath = value.startsWith("file:") ? value.slice("file:".length) : value;
  return path.resolve(process.cwd(), filePath);
}

function cloneEmptyDb(): DatabaseShape {
  return {
    users: [],
    sessions: [],
    emailVerificationTokens: [],
    passwordResetTokens: [],
    creditTransactions: [],
    orders: [],
    imageTasks: [],
    analyticsEvents: []
  };
}

function normalizeDb(data: Partial<DatabaseShape>): DatabaseShape {
  const now = new Date().toISOString();

  return {
    users: Array.isArray(data.users)
      ? data.users.map((user) => ({
          ...user,
          credits: typeof user.credits === "number" ? user.credits : 0,
          role: user.role === "admin" ? "admin" : "user",
          emailVerified: Boolean(user.emailVerified),
          emailVerifiedAt: user.emailVerifiedAt ?? null,
          lastLoginAt: user.lastLoginAt ?? null
        }))
      : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    emailVerificationTokens: Array.isArray(data.emailVerificationTokens) ? data.emailVerificationTokens : [],
    passwordResetTokens: Array.isArray(data.passwordResetTokens) ? data.passwordResetTokens : [],
    creditTransactions: Array.isArray(data.creditTransactions)
      ? data.creditTransactions.map((transaction) => ({
          ...transaction,
          orderId: transaction.orderId ?? null,
          taskId: transaction.taskId ?? null
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
    imageTasks: Array.isArray(data.imageTasks)
      ? data.imageTasks.map((task) => ({
          ...task,
          resultImages: Array.isArray(task.resultImages) ? task.resultImages : [],
          creditCharged: Boolean(task.creditCharged)
        }))
      : [],
    analyticsEvents: Array.isArray(data.analyticsEvents)
      ? data.analyticsEvents
          .filter((event) => event && ANALYTICS_EVENT_TYPES.has(event.type) && typeof event.path === "string")
          .map((event) => ({
            ...event,
            type: event.type === "purchase_click" ? "purchase_click" : "page_view",
            target: event.target ?? null,
            metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : null,
            referrer: event.referrer ?? null,
            userId: event.userId ?? null,
            userAgent: event.userAgent ?? null
          }))
      : []
  };
}

async function ensureFileDbFile() {
  const dbPath = resolveDbPath();
  await mkdir(path.dirname(dbPath), { recursive: true });

  try {
    await readFile(dbPath, "utf-8");
  } catch {
    await writeFile(dbPath, JSON.stringify(EMPTY_DB, null, 2), "utf-8");
  }
}

async function readFileDb(): Promise<DatabaseShape> {
  await ensureFileDbFile();
  const raw = await readFile(resolveDbPath(), "utf-8");
  const data = JSON.parse(raw || "{}") as Partial<DatabaseShape>;
  return normalizeDb(data);
}

async function writeFileDb(data: DatabaseShape) {
  await ensureFileDbFile();
  await writeFile(resolveDbPath(), JSON.stringify(data, null, 2), "utf-8");
}

async function getMysqlPool() {
  if (!mysqlPoolPromise) {
    mysqlPoolPromise = import("mysql2/promise").then((mysql) =>
      mysql.createPool({
        uri: databaseUrl(),
        waitForConnections: true,
        connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || "5"),
        charset: "utf8mb4",
        dateStrings: true
      })
    );
  }

  return mysqlPoolPromise as Promise<{
    getConnection: () => Promise<MysqlConnection>;
    query: (sql: string, values?: unknown[]) => Promise<unknown>;
    execute: (sql: string, values?: unknown[]) => Promise<unknown>;
  }>;
}

interface MysqlConnection {
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
  execute: (sql: string, values?: unknown[]) => Promise<unknown>;
}

function rowsFromResult(result: unknown) {
  return Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as Array<Record<string, unknown>>) : [];
}

function affectedRowsFromResult(result: unknown) {
  if (!Array.isArray(result) || !result[0] || typeof result[0] !== "object") return 0;
  return Number((result[0] as { affectedRows?: number }).affectedRows || 0);
}

function parseMysqlJsonRecord(value: unknown) {
  if (typeof value === "string") {
    return JSON.parse(value);
  }

  if (Buffer.isBuffer(value)) {
    return JSON.parse(value.toString("utf-8"));
  }

  return value;
}

function hashJson(json: string) {
  return createHash("sha256").update(json).digest("hex");
}

function rowKey(collection: DbCollectionName, id: string) {
  return `${collection}\u0000${id}`;
}

function recordId(collection: DbCollectionName, record: unknown, index: number) {
  if (record && typeof record === "object" && "id" in record) {
    const id = String((record as { id?: unknown }).id || "");
    if (id) return id.slice(0, 191);
  }

  return `${collection}-${index}`;
}

async function ensureMysqlSchema(connection?: MysqlConnection) {
  if (mysqlSchemaReady) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS imagegood_records (
      collection VARCHAR(64) NOT NULL,
      id VARCHAR(191) NOT NULL,
      record JSON NOT NULL,
      record_hash CHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (collection, id),
      INDEX idx_imagegood_records_collection (collection)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS imagegood_meta (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      value_json JSON NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `INSERT IGNORE INTO imagegood_meta (id, value_json) VALUES ('db_lock', JSON_OBJECT())`
  ];

  if (connection) {
    for (const statement of statements) {
      await connection.execute(statement);
    }
    await ensureMysqlRecordHashColumn(connection);
  } else {
    const pool = await getMysqlPool();
    for (const statement of statements) {
      await pool.execute(statement);
    }
    await ensureMysqlRecordHashColumn(pool);
  }

  mysqlSchemaReady = true;
}

async function ensureMysqlRecordHashColumn(target: Pick<MysqlConnection, "execute">) {
  try {
    await target.execute("ALTER TABLE imagegood_records ADD COLUMN record_hash CHAR(64) NULL AFTER record");
  } catch (error) {
    const code = (error as { code?: string; errno?: number }).code;
    const errno = (error as { errno?: number }).errno;
    if (code !== "ER_DUP_FIELDNAME" && errno !== 1060) {
      throw error;
    }
  }
}

async function readMysqlSnapshot(options?: { includeAnalytics?: boolean }): Promise<MysqlSnapshot> {
  await ensureMysqlSchema();
  const pool = await getMysqlPool();
  const result = await pool.query(
    options?.includeAnalytics
      ? "SELECT collection, id, record, record_hash FROM imagegood_records ORDER BY collection, id"
      : "SELECT collection, id, record, record_hash FROM imagegood_records WHERE collection <> 'analyticsEvents' ORDER BY collection, id"
  );
  const rows = rowsFromResult(result);
  const data = cloneEmptyDb();
  const dbHashes = new Map<string, string | null>();

  for (const row of rows) {
    const collection = String(row.collection || "") as DbCollectionName;
    if (!COLLECTIONS.includes(collection)) continue;

    const id = String(row.id || "");
    if (id) {
      dbHashes.set(rowKey(collection, id), typeof row.record_hash === "string" ? row.record_hash : null);
    }

    const record = parseMysqlJsonRecord(row.record);
    if (record) {
      (data[collection] as unknown[]).push(record);
    }
  }

  const normalized = normalizeDb(data);
  const states = recordsToStateMap(normalized, dbHashes);
  return { data: normalized, states };
}

async function readMysqlDb(options?: { includeAnalytics?: boolean }): Promise<DatabaseShape> {
  return (await readMysqlSnapshot(options)).data;
}

function recordsToStateMap(data: DatabaseShape, dbHashes?: Map<string, string | null>) {
  const states = new Map<string, MysqlRecordState>();

  for (const collection of COLLECTIONS) {
    const records = data[collection] as unknown[];
    for (const [index, record] of records.entries()) {
      const id = recordId(collection, record, index);
      const json = JSON.stringify(record);
      const key = rowKey(collection, id);
      states.set(key, {
        collection,
        id,
        json,
        dbHash: dbHashes?.has(key) ? dbHashes.get(key) ?? null : hashJson(json)
      });
    }
  }

  return states;
}

function diffMysqlChanges(previous: Map<string, MysqlRecordState>, nextData: DatabaseShape) {
  const next = recordsToStateMap(nextData);
  const upserts: MysqlChange[] = [];
  const deletes: MysqlDelete[] = [];

  for (const [key, nextState] of next) {
    const oldState = previous.get(key);
    const nextHash = hashJson(nextState.json);
    if (!oldState || oldState.json !== nextState.json) {
      upserts.push({
        collection: nextState.collection,
        id: nextState.id,
        json: nextState.json,
        hash: nextHash,
        previous: oldState
      });
    }
  }

  for (const [key, oldState] of previous) {
    if (!next.has(key)) {
      deletes.push({
        collection: oldState.collection,
        id: oldState.id,
        previous: oldState
      });
    }
  }

  return { upserts, deletes };
}

async function executeMysqlWithHashGuard(
  connection: MysqlConnection,
  sqlWithHash: string,
  sqlWithoutHash: string,
  values: unknown[],
  previousHash: string | null
) {
  const result =
    previousHash === null
      ? await connection.execute(sqlWithoutHash, values)
      : await connection.execute(sqlWithHash, [...values, previousHash]);
  return affectedRowsFromResult(result);
}

async function commitMysqlChanges(upserts: MysqlChange[], deletes: MysqlDelete[]) {
  if (upserts.length === 0 && deletes.length === 0) return;

  const pool = await getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.query("SET SESSION innodb_lock_wait_timeout = 5");
    await connection.beginTransaction();

    for (const change of upserts) {
      if (change.previous) {
        const affectedRows = await executeMysqlWithHashGuard(
          connection,
          `UPDATE imagegood_records
           SET record = ?, record_hash = ?
           WHERE collection = ? AND id = ? AND record_hash = ?`,
          `UPDATE imagegood_records
           SET record = ?, record_hash = ?
           WHERE collection = ? AND id = ? AND record_hash IS NULL`,
          [change.json, change.hash, change.collection, change.id],
          change.previous.dbHash
        );

        if (affectedRows !== 1) {
          throw new MysqlWriteConflictError();
        }
      } else {
        const affectedRows = affectedRowsFromResult(
          await connection.execute(
            "INSERT IGNORE INTO imagegood_records (collection, id, record, record_hash) VALUES (?, ?, ?, ?)",
            [change.collection, change.id, change.json, change.hash]
          )
        );

        if (affectedRows !== 1) {
          throw new MysqlWriteConflictError();
        }
      }
    }

    for (const item of deletes) {
      const affectedRows = await executeMysqlWithHashGuard(
        connection,
        "DELETE FROM imagegood_records WHERE collection = ? AND id = ? AND record_hash = ?",
        "DELETE FROM imagegood_records WHERE collection = ? AND id = ? AND record_hash IS NULL",
        [item.collection, item.id],
        item.previous.dbHash
      );

      if (affectedRows !== 1) {
        throw new MysqlWriteConflictError();
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function isMysqlTransientError(error: unknown) {
  const code = (error as { code?: string }).code;
  const errno = (error as { errno?: number }).errno;
  return (
    error instanceof MysqlWriteConflictError ||
    code === "ER_LOCK_WAIT_TIMEOUT" ||
    code === "ER_LOCK_DEADLOCK" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    errno === 1205 ||
    errno === 1213
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withMysqlDb<T>(mutator: (db: DatabaseShape) => T | Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MYSQL_WRITE_RETRIES; attempt += 1) {
    try {
      const snapshot = await readMysqlSnapshot();
      const result = await mutator(snapshot.data);
      const { upserts, deletes } = diffMysqlChanges(snapshot.states, snapshot.data);
      await commitMysqlChanges(upserts, deletes);
      return result;
    } catch (error) {
      if (!isMysqlTransientError(error) || attempt === MYSQL_WRITE_RETRIES) {
        throw error;
      }

      lastError = error;
      await wait(80 * attempt);
    }
  }

  throw lastError;
}

async function readDb(options?: { includeAnalytics?: boolean }): Promise<DatabaseShape> {
  return isMysqlDatabaseUrl() ? readMysqlDb(options) : readFileDb();
}

async function withFileDb<T>(mutator: (db: DatabaseShape) => T | Promise<T>) {
  const run = async () => {
    const db = await readFileDb();
    const result = await mutator(db);
    await writeFileDb(db);
    return result;
  };

  const next = writeQueue.then(run, run);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );

  return next;
}

function redactedMysqlUrl() {
  try {
    const parsed = new URL(databaseUrl());
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "mysql://***";
  }
}

export async function withDb<T>(mutator: (db: DatabaseShape) => T | Promise<T>) {
  return isMysqlDatabaseUrl() ? withMysqlDb(mutator) : withFileDb(mutator);
}

export async function getDbSnapshot(options?: { includeAnalytics?: boolean }) {
  return readDb(options);
}

export async function initDb() {
  if (isMysqlDatabaseUrl()) {
    await ensureMysqlSchema();
    return redactedMysqlUrl();
  }

  await ensureFileDbFile();
  return resolveDbPath();
}

export async function appendAnalyticsEvent(event: AnalyticsEventRecord, maxEvents = 20_000) {
  if (!isMysqlDatabaseUrl()) {
    await withFileDb((db) => {
      db.analyticsEvents.push(event);
      if (db.analyticsEvents.length > maxEvents) {
        db.analyticsEvents = db.analyticsEvents.slice(-maxEvents);
      }
    });
    return;
  }

  await ensureMysqlSchema();
  const pool = await getMysqlPool();
  const json = JSON.stringify(event);
  await pool.execute(
    "INSERT INTO imagegood_records (collection, id, record, record_hash) VALUES ('analyticsEvents', ?, ?, ?) ON DUPLICATE KEY UPDATE record = VALUES(record), record_hash = VALUES(record_hash)",
    [event.id, json, hashJson(json)]
  );

  if (Math.random() < 0.02) {
    const keep = Math.max(1000, Math.floor(maxEvents));
    await pool.execute(
      `DELETE FROM imagegood_records
       WHERE collection = 'analyticsEvents'
         AND id NOT IN (
           SELECT id FROM (
             SELECT id
             FROM imagegood_records
             WHERE collection = 'analyticsEvents'
             ORDER BY JSON_UNQUOTE(JSON_EXTRACT(record, '$.createdAt')) DESC
             LIMIT ${keep}
           ) AS recent_events
         )`
    );
  }
}
