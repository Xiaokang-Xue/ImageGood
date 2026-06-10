import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_PREFIX = "scrypt";
const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"];

type BcryptModule = {
  hash?: (data: string, saltOrRounds: number) => Promise<string>;
  compare?: (data: string, encrypted: string) => Promise<boolean>;
  default?: {
    hash?: (data: string, saltOrRounds: number) => Promise<string>;
    compare?: (data: string, encrypted: string) => Promise<boolean>;
  };
};

let bcryptPromise: Promise<BcryptModule | null> | null = null;

function createScryptHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

function verifyScryptPassword(password: string, storedHash: string) {
  const parts = storedHash.includes("$") ? storedHash.split("$") : ["legacy", ...storedHash.split(":")];
  const salt = parts[1];
  const hash = parts[2];
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function isBcryptHash(storedHash: string) {
  return BCRYPT_PREFIXES.some((prefix) => storedHash.startsWith(prefix));
}

async function loadBcrypt() {
  if (!bcryptPromise) {
    bcryptPromise = (async () => {
      try {
        const dynamicImport = Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
        return (await dynamicImport("bcryptjs")) as BcryptModule;
      } catch {
        return null;
      }
    })();
  }

  return bcryptPromise;
}

export async function hashPassword(password: string) {
  const bcrypt = await loadBcrypt();
  const hash = bcrypt?.hash || bcrypt?.default?.hash;
  if (hash) {
    return hash(password, 12);
  }

  return createScryptHash(password);
}

export async function verifyPassword(password: string, storedHash: string) {
  if (isBcryptHash(storedHash)) {
    const bcrypt = await loadBcrypt();
    const compare = bcrypt?.compare || bcrypt?.default?.compare;
    return compare ? compare(password, storedHash) : false;
  }

  return verifyScryptPassword(password, storedHash);
}
