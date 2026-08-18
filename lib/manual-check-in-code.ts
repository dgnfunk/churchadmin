import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function normalizeManualCheckInCode(value: string) {
  const characters = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return characters.length > 4 ? `${characters.slice(0, 4)}-${characters.slice(4)}` : characters;
}

export function createManualCheckInCode(bytes = randomBytes(8)) {
  const characters = Array.from(bytes.subarray(0, 8), (value) => alphabet[value % alphabet.length]).join("");
  return `${characters.slice(0, 4)}-${characters.slice(4)}`;
}

export async function createUniqueManualCheckInCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createManualCheckInCode();
    const existing = await prisma.attendanceSession.findUnique({ where: { manualCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("A unique manual check-in code could not be generated.");
}
