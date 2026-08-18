"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeContact } from "@/lib/contact";
import { createUniqueManualCheckInCode } from "@/lib/manual-check-in-code";
import { canAccess, hasServicePermission } from "@/lib/permissions";
import { formError } from "@/lib/form-state";
import { databaseList, stringList } from "@/lib/database-compat";

async function requireSessionPermission(sessionId: string, permission: "attendance.checkin.manual" | "attendance.sessions.manage") {
  const user = await requireUser();
  const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, churchId: user.churchId }, select: { servicePlanId: true } });
  if (!session) throw new Error("Attendance session was not found.");
  const allowed = canAccess(user, permission) || Boolean(session.servicePlanId && await hasServicePermission(user, permission, session.servicePlanId));
  if (!allowed) throw new Error("You do not have permission for this attendance session.");
  return user;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Unknown",
    lastName: parts.slice(1).join(" ") || "Guest"
  };
}

function contactFields(value: string) {
  const contact = value.trim();
  if (!contact) {
    return { email: null, phone: null };
  }

  return contact.includes("@") ? { email: contact, phone: null } : { email: null, phone: contact };
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value: string | null | undefined, region = "MX") {
  return value ? normalizeContact(value, region)?.phone ?? null : null;
}

export async function createPersonAction(formData: FormData) {
  const user = await requirePermission("people.manage");
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { defaultPhoneRegion: true } });
  const fullName = String(formData.get("name") ?? "");
  const personType = String(formData.get("type") ?? "VISITOR") === "MEMBER" ? "MEMBER" : "VISITOR";
  const contact = contactFields(String(formData.get("contact") ?? ""));
  if (fullName.trim().length < 2 || fullName.trim().length > 160) return formError("Escribe un nombre válido de entre 2 y 160 caracteres.", { name: "El nombre completo es obligatorio." });
  if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email)) return formError("Escribe un correo electrónico válido.", { contact: "El correo no tiene un formato válido." });
  const normalizedEmail = normalizeEmail(contact.email);
  const normalizedPhone = normalizePhone(contact.phone, church.defaultPhoneRegion);
  if (contact.phone && !normalizedPhone) return formError("Escribe un número telefónico válido.", { contact: "El teléfono no tiene un formato válido." });
  if (normalizedEmail || normalizedPhone) {
    const existing = await prisma.person.findFirst({ where: { churchId: user.churchId, OR: [...(normalizedEmail ? [{ normalizedEmail }] : []), ...(normalizedPhone ? [{ normalizedPhone }] : [])] }, select: { id: true } });
    if (existing) return formError("Ya existe una persona con ese correo o teléfono.", { contact: "Este contacto ya está registrado." }, { href: `/people?personId=${existing.id}`, label: "Abrir persona existente" });
  }
  const { firstName, lastName } = splitFullName(fullName);

  await prisma.person.create({
    data: {
      churchId: user.churchId,
      personType,
      status: personType === "VISITOR" ? "FOLLOW_UP" : "ACTIVE",
      firstName,
      lastName,
      email: contact.email,
      phone: contact.phone,
      normalizedEmail,
      normalizedPhone,
      tags: personType === "VISITOR" ? ["first-time"] : []
    }
  });

  revalidatePath("/people");
  revalidatePath("/attendance");
}

export async function markManualAttendanceAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const user = await requireSessionPermission(sessionId, "attendance.checkin.manual");
  const personId = String(formData.get("personId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!sessionId || !personId) {
    return formError("Selecciona una persona para registrar su asistencia.", { personId: "La persona es obligatoria." });
  }
  const [session, person] = await Promise.all([
    prisma.attendanceSession.findFirst({ where: { id: sessionId, churchId: user.churchId }, select: { id: true } }),
    prisma.person.findFirst({ where: { id: personId, churchId: user.churchId }, select: { id: true } })
  ]);
  if (!session || !person) return formError("La sesión o la persona ya no está disponible.");

  await prisma.attendanceRecord.upsert({
    where: {
      sessionId_personId: {
        sessionId,
        personId: person.id
      }
    },
    update: {
      source: "MANUAL",
      notes
    },
    create: {
      sessionId,
      personId,
      source: "MANUAL",
      notes
    }
  });

  revalidatePath("/");
  revalidatePath("/attendance");
}

export async function createAttendanceSessionAction(formData?: FormData) {
  const user = await requirePermission("attendance.sessions.manage");
  const churchId = user.churchId;
  const requestedPlanId = String(formData?.get("servicePlanId") ?? "").trim();
  const requestedPlan = requestedPlanId ? await prisma.servicePlan.findFirst({ where: { id: requestedPlanId, churchId }, select: { id: true, title: true, serviceAt: true } }) : null;
  if (requestedPlanId && !requestedPlan) return formError("El servicio seleccionado ya no está disponible.", { servicePlanId: "Selecciona otro servicio." });
  if (requestedPlan) {
    const existing = await prisma.attendanceSession.findUnique({ where: { servicePlanId: requestedPlan.id } });
    if (existing) return formError("Ese servicio ya tiene una sesión de asistencia.", undefined, { href: `/attendance?view=check-in&sessionId=${existing.id}`, label: "Abrir sesión existente" });
  }
  const latest = await prisma.attendanceSession.findFirst({
    where: { churchId },
    orderBy: { serviceAt: "desc" }
  });
  const serviceAt = requestedPlan ? new Date(requestedPlan.serviceAt) : latest?.serviceAt ? new Date(latest.serviceAt) : new Date();
  if (!requestedPlan) {
    const daysUntilSunday = (7 - serviceAt.getUTCDay()) % 7 || 7;
    serviceAt.setUTCDate(serviceAt.getUTCDate() + daysUntilSunday);
    serviceAt.setUTCHours(10, 0, 0, 0);
  }
  await prisma.attendanceSession.create({
    data: {
      churchId,
      title: requestedPlan?.title ?? "Sunday Worship",
      serviceAt,
      qrToken: randomBytes(32).toString("hex"),
      manualCode: await createUniqueManualCheckInCode(),
      status: "OPEN",
      expiresAt: new Date(serviceAt.getTime() + 12 * 60 * 60 * 1000),
      servicePlanId: requestedPlan?.id
    }
  });

  revalidatePath("/");
  revalidatePath("/attendance");
}

export async function setAttendanceSessionStatusAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const user = await requireSessionPermission(sessionId, "attendance.sessions.manage");
  const requested = String(formData.get("status") ?? "CLOSED") === "OPEN" ? "OPEN" : "CLOSED";
  const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, churchId: user.churchId } });
  if (!session) return formError("La sesión de asistencia ya no está disponible.");
  await prisma.attendanceSession.update({ where: { id: session.id }, data: {
    status: requested, closedAt: requested === "CLOSED" ? new Date() : null,
    expiresAt: requested === "OPEN" ? new Date(Date.now() + 12 * 60 * 60 * 1000) : session.expiresAt
  } });
  revalidatePath("/attendance");
}

export async function regenerateAttendanceQrAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const user = await requireSessionPermission(sessionId, "attendance.sessions.manage");
  const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, churchId: user.churchId }, select: { id: true } });
  if (!session) return formError("La sesión de asistencia ya no está disponible.");
  await prisma.attendanceSession.update({ where: { id: session.id }, data: {
    qrToken: randomBytes(32).toString("hex"),
    manualCode: await createUniqueManualCheckInCode()
  } });
  revalidatePath("/attendance");
}

export async function removeAttendanceRecordAction(formData: FormData) {
  const recordId = String(formData.get("recordId") ?? "");
  const recordOwner = await prisma.attendanceRecord.findUnique({ where: { id: recordId }, select: { sessionId: true } });
  if (!recordOwner) return formError("El registro de asistencia ya no está disponible.");
  const user = await requireSessionPermission(recordOwner.sessionId, "attendance.checkin.manual");
  const record = await prisma.attendanceRecord.findFirst({ where: { id: recordId, session: { churchId: user.churchId } } });
  if (!record) return formError("El registro de asistencia ya no está disponible.");
  await prisma.attendanceRecord.delete({ where: { id: record.id } });
  revalidatePath("/attendance");
  revalidatePath("/");
}

export async function createVisitorAndMarkAttendanceAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const user = await requireSessionPermission(sessionId, "attendance.checkin.manual");
  const fullName = String(formData.get("name") ?? "").trim();
  const contact = contactFields(String(formData.get("contact") ?? ""));
  if (!sessionId || fullName.length < 2 || fullName.length > 160) return formError("Escribe el nombre completo del visitante.", { name: "El nombre debe tener entre 2 y 160 caracteres." });
  const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, churchId: user.churchId }, include: { church: { select: { defaultPhoneRegion: true } } } });
  if (!session) return formError("La sesión de asistencia ya no está disponible.");
  const normalizedEmail = normalizeEmail(contact.email);
  const normalizedPhone = normalizePhone(contact.phone, session.church.defaultPhoneRegion);
  if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email)) return formError("Escribe un correo electrónico válido.", { contact: "El correo no tiene un formato válido." });
  if (contact.phone && !normalizedPhone) return formError("Escribe un número telefónico válido.", { contact: "El teléfono no tiene un formato válido." });
  const existing = normalizedEmail || normalizedPhone ? await prisma.person.findFirst({ where: { churchId: user.churchId, OR: [
    ...(normalizedEmail ? [{ normalizedEmail }] : []), ...(normalizedPhone ? [{ normalizedPhone }] : [])
  ] } }) : null;
  const names = splitFullName(fullName);
  const person = existing ?? await prisma.person.create({ data: {
    churchId: user.churchId, personType: "VISITOR", status: "FOLLOW_UP", ...names,
    email: contact.email, phone: contact.phone, normalizedEmail, normalizedPhone, tags: ["first-time"]
  } });
  await prisma.attendanceRecord.upsert({
    where: { sessionId_personId: { sessionId: session.id, personId: person.id } },
    update: { source: "MANUAL" }, create: { sessionId: session.id, personId: person.id, source: "MANUAL" }
  });
  revalidatePath("/attendance"); revalidatePath("/people"); revalidatePath("/");
}

export async function updatePersonAction(formData: FormData) {
  const user = await requirePermission("people.manage");
  const id = String(formData.get("personId") ?? "");
  const person = await prisma.person.findFirst({ where: { id, churchId: user.churchId }, include: { church: { select: { defaultPhoneRegion: true } } } });
  if (!person) return formError("La persona ya no está disponible.");
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80) return formError("Nombre y apellido son obligatorios y no pueden exceder 80 caracteres.", { firstName: !firstName ? "El nombre es obligatorio." : "", lastName: !lastName ? "El apellido es obligatorio." : "" });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return formError("Escribe un correo electrónico válido.", { email: "El correo no tiene un formato válido." });
  const normalizedPhone = normalizePhone(phone, person.church.defaultPhoneRegion);
  if (phone && !normalizedPhone) return formError("Escribe un número telefónico válido.", { phone: "El teléfono no tiene un formato válido." });
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail || normalizedPhone) {
    const duplicate = await prisma.person.findFirst({ where: { churchId: user.churchId, id: { not: person.id }, OR: [...(normalizedEmail ? [{ normalizedEmail }] : []), ...(normalizedPhone ? [{ normalizedPhone }] : [])] }, select: { id: true } });
    if (duplicate) return formError("Otra persona ya utiliza ese correo o teléfono.", undefined, { href: `/people?personId=${duplicate.id}`, label: "Revisar duplicado" });
  }
  const personType = String(formData.get("personType")) === "VISITOR" ? "VISITOR" : "MEMBER";
  const statusValue = String(formData.get("status"));
  const status = ["ACTIVE", "INACTIVE", "FOLLOW_UP"].includes(statusValue) ? statusValue as "ACTIVE" | "INACTIVE" | "FOLLOW_UP" : "ACTIVE";
  await prisma.person.update({ where: { id: person.id }, data: {
    firstName, lastName,
    email, phone, normalizedEmail, normalizedPhone, personType, status,
    familyNotes: String(formData.get("familyNotes") ?? "").trim() || null,
    tags: String(formData.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean)
  } });
  revalidatePath("/people"); revalidatePath("/attendance");
}

export async function mergePeopleAction(formData: FormData) {
  const user = await requirePermission("people.manage");
  const targetId = String(formData.get("targetId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!targetId || !sourceId || targetId === sourceId) return formError("Selecciona dos personas diferentes para combinarlas.");
  const people = await prisma.person.findMany({ where: { churchId: user.churchId, id: { in: [targetId, sourceId] } }, include: { attendance: true } });
  const target = people.find((person) => person.id === targetId); const source = people.find((person) => person.id === sourceId);
  if (!target || !source) return formError("Una de las personas seleccionadas ya no está disponible.");
  await prisma.$transaction(async (tx) => {
    for (const record of source.attendance) {
      await tx.attendanceRecord.upsert({
        where: { sessionId_personId: { sessionId: record.sessionId, personId: target.id } },
        update: {}, create: { sessionId: record.sessionId, personId: target.id, source: record.source, checkedInAt: record.checkedInAt, notes: record.notes }
      });
    }
    await tx.attendanceRecord.deleteMany({ where: { personId: source.id } });
    await tx.person.update({ where: { id: target.id }, data: { tags: databaseList([...new Set([...stringList(target.tags), ...stringList(source.tags)])]) } });
    await tx.person.delete({ where: { id: source.id } });
  });
  revalidatePath("/people"); revalidatePath("/attendance"); revalidatePath("/");
}

export async function importPeopleRows(rows: Array<Record<string, string>>) {
  const user = await requirePermission("people.manage");
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { defaultPhoneRegion: true } });
  const errors: string[] = [];
  let imported = 0;
  for (const [index, row] of rows.slice(0, 2000).entries()) {
    try {
      const firstName = row.firstName?.trim(); const lastName = row.lastName?.trim();
      if (!firstName || !lastName) throw new Error("firstName y lastName son obligatorios");
      if (firstName.length > 80 || lastName.length > 80) throw new Error("el nombre y apellido no pueden exceder 80 caracteres");
      const normalizedEmail = normalizeEmail(row.email); const normalizedPhone = normalizePhone(row.phone, church.defaultPhoneRegion);
      if (row.email?.trim() && !/^\S+@\S+\.\S+$/.test(row.email.trim())) throw new Error("el correo no tiene un formato válido");
      if (row.phone?.trim() && !normalizedPhone) throw new Error("el teléfono no tiene un formato válido");
      const existing = normalizedEmail || normalizedPhone ? await prisma.person.findFirst({ where: { churchId: user.churchId, OR: [
        ...(normalizedEmail ? [{ normalizedEmail }] : []), ...(normalizedPhone ? [{ normalizedPhone }] : [])
      ] } }) : null;
      const data = { firstName, lastName, email: row.email?.trim() || null, phone: row.phone?.trim() || null, normalizedEmail, normalizedPhone,
        personType: row.personType === "MEMBER" ? "MEMBER" as const : "VISITOR" as const,
        status: ["ACTIVE", "INACTIVE", "FOLLOW_UP"].includes(row.status) ? row.status as "ACTIVE" | "INACTIVE" | "FOLLOW_UP" : "ACTIVE" as const,
        familyNotes: row.familyNotes?.trim() || null, tags: row.tags?.split("|").map((tag) => tag.trim()).filter(Boolean) ?? [] };
      if (existing) await prisma.person.update({ where: { id: existing.id }, data });
      else await prisma.person.create({ data: { ...data, churchId: user.churchId } });
      imported++;
    } catch (error) { errors.push(`Fila ${index + 2}: ${error instanceof Error ? error.message : "fila no válida"}`); }
  }
  revalidatePath("/people");
  return { imported, errors };
}
