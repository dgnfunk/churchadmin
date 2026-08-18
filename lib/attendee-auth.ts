import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const attendeeCookieName = "church_attendee_session";
const attendeeSessionDays = 180;

function attendeeSecret() {
  const value = process.env.ATTENDEE_SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("ATTENDEE_SESSION_SECRET is required in production.");
  return value ?? "churchadmin-attendee-development-secret";
}

export function hashAttendeeToken(token: string) {
  return createHmac("sha256", attendeeSecret()).update(token).digest("hex");
}

function nextExpiry() {
  return new Date(Date.now() + attendeeSessionDays * 24 * 60 * 60 * 1000);
}

async function setAttendeeCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(attendeeCookieName, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    expires: expiresAt, maxAge: attendeeSessionDays * 24 * 60 * 60, path: "/check-in"
  });
}

export async function getCurrentAttendee(churchId?: string) {
  const token = (await cookies()).get(attendeeCookieName)?.value;
  if (!token) return null;
  return prisma.attendeeSession.findFirst({
    where: { tokenHash: hashAttendeeToken(token), revokedAt: null, expiresAt: { gt: new Date() }, ...(churchId ? { churchId } : {}) },
    include: { person: true }
  });
}

export async function createAttendeeSession(churchId: string, personId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = nextExpiry();
  const session = await prisma.attendeeSession.create({ data: { churchId, personId, tokenHash: hashAttendeeToken(token), expiresAt } });
  await setAttendeeCookie(token, expiresAt);
  return session;
}

export async function renewAttendeeSession(id: string) {
  const token = (await cookies()).get(attendeeCookieName)?.value;
  if (!token) return;
  const expiresAt = nextExpiry();
  await prisma.attendeeSession.update({ where: { id }, data: { expiresAt, lastUsedAt: new Date() } });
  await setAttendeeCookie(token, expiresAt);
}

export async function revokeAttendeeSession() {
  const store = await cookies();
  const token = store.get(attendeeCookieName)?.value;
  if (token) await prisma.attendeeSession.updateMany({ where: { tokenHash: hashAttendeeToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  store.set(attendeeCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), path: "/check-in" });
}

export async function cleanupExpiredAttendeeSessions() {
  const now = new Date();
  return prisma.$transaction([
    prisma.attendeeSession.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }] } }),
    prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } })
  ]);
}
