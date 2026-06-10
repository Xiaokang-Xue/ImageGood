import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

const emptyDb = {
  users: [],
  sessions: [],
  emailVerificationTokens: [],
  passwordResetTokens: [],
  creditTransactions: [],
  orders: [],
  imageTasks: [],
  analyticsEvents: []
};

function isMysqlDatabaseUrl(value) {
  return /^mysql2?:\/\//i.test(value);
}

function redactedDatabaseUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return value;
  }
}

async function initFileDatabase() {
  const filePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  const dbPath = path.resolve(process.cwd(), filePath);

  await mkdir(path.dirname(dbPath), { recursive: true });

  try {
    await readFile(dbPath, "utf-8");
    console.log(`Database already exists: ${dbPath}`);
  } catch {
    await writeFile(dbPath, JSON.stringify(emptyDb, null, 2), "utf-8");
    console.log(`Database initialized: ${dbPath}`);
  }
}

async function initMysqlDatabase() {
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection({
    uri: databaseUrl,
    charset: "utf8mb4",
    dateStrings: true
  });

  try {
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
    console.log(`MySQL database initialized: ${redactedDatabaseUrl(databaseUrl)}`);
  } finally {
    await connection.end();
  }
}

if (isMysqlDatabaseUrl(databaseUrl)) {
  await initMysqlDatabase();
} else {
  await initFileDatabase();
}
