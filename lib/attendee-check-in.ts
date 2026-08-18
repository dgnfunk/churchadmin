import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createAttendeeSession } from "@/lib/attendee-auth";
import { normalizeContact } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { databaseList, stringList } from "@/lib/database-compat";

export class CheckInError extends Error {
  constructor(message: string, public status = 400, public code = "invalid_request") { super(message); }
}

export async function requireOpenQrSession(qrToken: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { qrToken }, include: { church: { select: { id: true, defaultPhoneRegion: true } } }
  });
  if (!session) throw new CheckInError("This QR code is not valid.", 404, "invalid_qr");
  if (session.status !== "OPEN" || (session.expiresAt && session.expiresAt <= new Date())) {
    throw new CheckInError("Check-in for this service is closed.", 410, "closed");
  }
  return session;
}

export async function requireOpenManualSession(manualCode: string) {
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(manualCode)) {
    throw new CheckInError("This service code is not valid.", 404, "invalid_code");
  }
  const session = await prisma.attendanceSession.findUnique({ where: { manualCode } });
  if (!session || session.status !== "OPEN" || (session.expiresAt && session.expiresAt <= new Date())) {
    throw new CheckInError("This service code is not available.", 404, "invalid_code");
  }
  return session;
}

export async function consumeAttendeeRateLimit(request: Request, churchId: string, qrToken: string, action: string, limit: number) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const secret = process.env.ATTENDEE_SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "churchadmin-attendee-development-secret");
  if (!secret) throw new CheckInError("Check-in is not configured.", 503, "configuration");
  const keyHash = createHmac("sha256", secret).update(`${qrToken}:${address}`).digest("hex");
  const windowMs = 10 * 60 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const bucket = await prisma.rateLimitBucket.upsert({
    where: { action_keyHash_windowStart: { action, keyHash, windowStart } },
    create: { churchId, action, keyHash, windowStart, expiresAt: new Date(windowStart.getTime() + windowMs * 2), count: 1 },
    update: { count: { increment: 1 }, expiresAt: new Date(windowStart.getTime() + windowMs * 2) }
  });
  if (bucket.count > limit) throw new CheckInError("Too many attempts. Please wait a few minutes.", 429, "rate_limited");
}

export async function recordQrAttendance(sessionId: string, personId: string) {
  const existing = await prisma.attendanceRecord.findUnique({ where: { sessionId_personId: { sessionId, personId } } });
  if (existing) return { alreadyCheckedIn: true, checkedInAt: existing.checkedInAt };
  try {
    const record = await prisma.attendanceRecord.create({ data: { sessionId, personId, source: "QR" } });
    return { alreadyCheckedIn: false, checkedInAt: record.checkedInAt };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const record = await prisma.attendanceRecord.findUniqueOrThrow({ where: { sessionId_personId: { sessionId, personId } } });
    return { alreadyCheckedIn: true, checkedInAt: record.checkedInAt };
  }
}

async function markAmbiguous(people: Array<{ id: string; tags: unknown }>) {
  await prisma.$transaction(people.map((person) => prisma.person.update({
    where: { id: person.id }, data: { tags: databaseList([...new Set([...stringList(person.tags), "review-duplicate-contact"])]) }
  })));
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "Visitor", lastName: parts.slice(1).join(" ") || "Guest" };
}

export async function identifyAndCheckIn(input: { request: Request; qrToken: string; contact: string; mode: "existing" | "visitor"; name?: string; whatsappConsent?: boolean }) {
  const session = await requireOpenQrSession(input.qrToken);
  await consumeAttendeeRateLimit(input.request, session.churchId, input.qrToken, input.mode === "visitor" ? "attendee-create" : "attendee-identify", input.mode === "visitor" ? 10 : 30);
  const contact = normalizeContact(input.contact, session.church.defaultPhoneRegion);
  if (!contact) throw new CheckInError("Enter a valid email or phone number.", 400, "invalid_contact");
  const matches = await prisma.person.findMany({
    where: { churchId: session.churchId, ...(contact.kind === "email" ? { normalizedEmail: contact.value } : { normalizedPhone: contact.value }) },
    select: { id: true, firstName: true, tags: true, normalizedPhone: true }, take: 3
  });
  if (matches.length > 1) {
    await markAmbiguous(matches);
    throw new CheckInError("A volunteer needs to review this contact before check-in.", 409, "ambiguous_contact");
  }
  if (input.mode === "existing" && matches.length === 0) {
    throw new CheckInError("We could not identify this contact. Choose First visit or ask a volunteer for help.", 404, "not_found");
  }
  let person = matches[0];
  if (!person) {
    if (!input.name?.trim()) throw new CheckInError("Your full name is required.", 400, "name_required");
    const names = splitName(input.name);
    person = await prisma.person.create({ data: {
      churchId: session.churchId, personType: "VISITOR", status: "FOLLOW_UP", ...names,
      email: contact.email, phone: contact.phone, normalizedEmail: contact.email, normalizedPhone: contact.phone,
      tags: ["first-time"]
    }, select: { id: true, firstName: true, tags: true, normalizedPhone: true } });
  }
  const attendance = await recordQrAttendance(session.id, person.id);
  const whatsappRecipient = contact.kind === "phone" ? contact.value : person.normalizedPhone;
  if (input.whatsappConsent && whatsappRecipient) {
    await prisma.communicationConsent.upsert({
      where: { churchId_personId_channel: { churchId: session.churchId, personId: person.id, channel: "WHATSAPP" } },
      create: { churchId: session.churchId, personId: person.id, channel: "WHATSAPP", normalizedRecipient: whatsappRecipient, status: "OPTED_IN", source: "Check-in público", evidence: `Consentimiento explícito durante ${session.title}`, optedInAt: new Date() },
      update: { normalizedRecipient: whatsappRecipient, status: "OPTED_IN", source: "Check-in público", evidence: `Consentimiento explícito durante ${session.title}`, optedInAt: new Date(), optedOutAt: null },
    });
  }
  await createAttendeeSession(session.churchId, person.id);
  return { ...attendance, firstName: person.firstName };
}
