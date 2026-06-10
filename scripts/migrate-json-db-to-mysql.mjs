import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();

const databaseUrl = process.env.DATABASE_URL || "";
const sourceArg = process.argv[2];
const collections = [
  "users",
  "sessions",
  "emailVerificationTokens",
  "passwordResetTokens",
  "creditTransactions",
  "orders",
  "imageTasks",
  "analyticsEvents"
];

function isMysqlDatabaseUrl(value) {
  return /^mysql2?:\/\//i.test(value);
}

function redactedDatabaseUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "mysql://***";
  }
}

function resolveSourcePath() {
  if (!sourceArg) {
    throw new Error("请指定旧 JSON 数据库文件路径，例如：npm run db:migrate-json -- /data/photoshop_data/prod.db");
  }

  const filePath = sourceArg.startsWith("file:") ? sourceArg.slice("file:".length) : sourceArg;
  return path.resolve(process.cwd(), filePath);
}

function recordId(collection, record, index) {
  if (record && typeof record === "object" && record.id) {
    return String(record.id).slice(0, 191);
  }

  return `${collection}-${index}`;
}

function hashJson(json) {
  return createHash("sha256").update(json).digest("hex");
}

async function initSchema(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS imagegood_records (
    collection VARCHAR(64) NOT NULL,
    id VARCHAR(191) NOT NULL,
    record JSON NOT NULL,
    record_hash CHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (collection, id),
    INDEX idx_imagegood_records_collection (collection)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.execute(`CREATE TABLE IF NOT EXISTS imagegood_meta (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    value_json JSON NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.execute("INSERT IGNORE INTO imagegood_meta (id, value_json) VALUES ('db_lock', JSON_OBJECT())");
  try {
    await connection.execute("ALTER TABLE imagegood_records ADD COLUMN record_hash CHAR(64) NULL AFTER record");
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME" && error?.errno !== 1060) {
      throw error;
    }
  }
}

if (!isMysqlDatabaseUrl(databaseUrl)) {
  throw new Error("当前 DATABASE_URL 不是 MySQL 地址，请先在 .env.local 中配置 mysql://...");
}

const sourcePath = resolveSourcePath();
if (!existsSync(sourcePath)) {
  throw new Error(`旧 JSON 数据库文件不存在：${sourcePath}`);
}

const raw = readFileSync(sourcePath, "utf-8");
const data = JSON.parse(raw || "{}");
const mysql = await import("mysql2/promise");
const connection = await mysql.createConnection({
  uri: databaseUrl,
  charset: "utf8mb4",
  dateStrings: true
});

try {
  await initSchema(connection);
  await connection.beginTransaction();
  await connection.query("SELECT id FROM imagegood_meta WHERE id = 'db_lock' FOR UPDATE");
  await connection.execute("DELETE FROM imagegood_records");

  let total = 0;
  for (const collection of collections) {
    const records = Array.isArray(data[collection]) ? data[collection] : [];
    for (const [index, record] of records.entries()) {
      const json = JSON.stringify(record);
      await connection.execute(
        "INSERT INTO imagegood_records (collection, id, record, record_hash) VALUES (?, ?, ?, ?)",
        [collection, recordId(collection, record, index), json, hashJson(json)]
      );
      total += 1;
    }
    console.log(`${collection}: ${records.length}`);
  }

  await connection.commit();
  console.log(`JSON data migrated to MySQL: ${redactedDatabaseUrl(databaseUrl)}`);
  console.log(`Imported records: ${total}`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
