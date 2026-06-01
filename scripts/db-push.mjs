import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const filePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
const dbPath = path.resolve(process.cwd(), filePath);

const emptyDb = {
  users: [],
  sessions: [],
  passwordResetTokens: [],
  creditTransactions: [],
  orders: [],
  imageTasks: []
};

await mkdir(path.dirname(dbPath), { recursive: true });

try {
  await readFile(dbPath, "utf-8");
  console.log(`Database already exists: ${dbPath}`);
} catch {
  await writeFile(dbPath, JSON.stringify(emptyDb, null, 2), "utf-8");
  console.log(`Database initialized: ${dbPath}`);
}
