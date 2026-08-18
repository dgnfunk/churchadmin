import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const passwordSecret = process.env.PASSWORD_SECRET ?? "churchadmin-dev-secret";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${password}:${passwordSecret}`, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split(":");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const candidate = scryptSync(`${password}:${passwordSecret}`, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
