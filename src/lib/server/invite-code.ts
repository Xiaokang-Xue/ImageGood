import "server-only";
import { randomBytes } from "crypto";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, INVITE_CODE_LENGTH);
}

function randomInviteCode() {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

export function generateUniqueInviteCode(users: Array<{ inviteCode?: string | null }>) {
  const existing = new Set(users.map((user) => normalizeInviteCode(user.inviteCode || "")).filter(Boolean));
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const code = randomInviteCode();
    if (!existing.has(code)) return code;
  }
  throw new Error("INVITE_CODE_GENERATION_FAILED");
}
