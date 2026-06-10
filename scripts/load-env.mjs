import { existsSync, readFileSync } from "fs";
import path from "path";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const index = trimmed.indexOf("=");
  if (index === -1) return null;

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
}

export function loadEnvFiles(cwd = process.cwd()) {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(cwd, filename);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;

      const [key, value] = parsed;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
