import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();

const databaseUrl = process.env.DATABASE_URL || "";
if (!/^mysql2?:\/\//i.test(databaseUrl)) {
  throw new Error("DATABASE_URL 不是 MySQL 地址");
}

function connectionUrl(value) {
  const parsed = new URL(value);
  parsed.searchParams.delete("connection_limit");
  parsed.searchParams.delete("connectionLimit");
  return parsed.toString();
}

function decodeRecord(value) {
  let current = Buffer.isBuffer(value) ? value.toString("utf-8") : value;
  for (let depth = 0; depth < 3 && typeof current === "string"; depth += 1) {
    current = JSON.parse(current);
  }
  return current;
}

const userOwnedCollections = new Set([
  "sessions",
  "emailVerificationTokens",
  "passwordResetTokens",
  "creditTransactions",
  "orders",
  "imageTasks"
]);

const mysql = await import("mysql2/promise");
const connection = await mysql.createConnection({
  uri: connectionUrl(databaseUrl),
  charset: "utf8mb4",
  dateStrings: true
});

try {
  const [rows] = await connection.query(
    `SELECT collection, id, record, JSON_TYPE(record) AS root_type
     FROM imagegood_records
     ORDER BY collection, id`
  );

  const users = new Set();
  const references = [];
  const collectionStats = new Map();
  const problems = [];

  for (const row of rows) {
    const collection = String(row.collection || "");
    const id = String(row.id || "");
    const rootType = String(row.root_type || "UNKNOWN");
    const stats = collectionStats.get(collection) || {
      total: 0,
      objectRoots: 0,
      stringRoots: 0
    };
    stats.total += 1;
    if (rootType === "OBJECT") stats.objectRoots += 1;
    if (rootType === "STRING") stats.stringRoots += 1;
    collectionStats.set(collection, stats);

    let record;
    try {
      record = decodeRecord(row.record);
    } catch {
      problems.push(`${collection}/${id}: record 无法解析`);
      continue;
    }

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      problems.push(`${collection}/${id}: record 不是对象`);
      continue;
    }
    if (record.id && String(record.id) !== id) {
      problems.push(`${collection}/${id}: 行 ID 与 record.id 不一致`);
    }
    if (collection === "users") {
      users.add(id);
    } else if (userOwnedCollections.has(collection)) {
      const userId = String(record.userId || "");
      if (!userId) {
        problems.push(`${collection}/${id}: 缺少 userId`);
      } else {
        references.push({ collection, id, userId });
      }
    }
  }

  for (const reference of references) {
    if (!users.has(reference.userId)) {
      problems.push(
        `${reference.collection}/${reference.id}: 引用了不存在的用户 ${reference.userId}`
      );
    }
  }

  console.log(`[db:audit] records=${rows.length} collections=${collectionStats.size}`);
  for (const [collection, stats] of [...collectionStats.entries()].sort()) {
    console.log(
      `[db:audit] ${collection}: total=${stats.total} object=${stats.objectRoots} string=${stats.stringRoots}`
    );
  }

  if (problems.length === 0) {
    console.log("[db:audit] OK：未发现记录解析、ID 或用户引用问题");
  } else {
    console.error(`[db:audit] 发现 ${problems.length} 个问题：`);
    for (const problem of problems.slice(0, 100)) {
      console.error(`- ${problem}`);
    }
    if (problems.length > 100) {
      console.error(`- 其余 ${problems.length - 100} 个问题已省略`);
    }
    process.exitCode = 1;
  }
} finally {
  await connection.end();
}
