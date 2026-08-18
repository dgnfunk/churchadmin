"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { databaseList, databaseProvider, stringList } from "@/lib/database-compat";
import { formError, type FormActionState } from "@/lib/form-state";
import { validateScheduledServiceDraft } from "@/lib/service-form";

const activeAssignmentStatuses = ["PENDING_CONFIRMATION", "CONFIRMED"] as const;
const refresh = () => { revalidatePath("/schedule"); revalidatePath("/services"); revalidatePath("/"); };

async function notifyPerson(personId: string, churchId: string, title: string, body: string, href = "/schedule?view=my") {
  const user = await prisma.user.findFirst({ where: { churchId, personId, isActive: true }, select: { id: true } });
  if (user) await prisma.notification.create({ data: { churchId, userId: user.id, title, body, href } });
}

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  return {
    start: new Date(Date.UTC(year, monthIndex, 1) - 36 * 60 * 60 * 1000),
    end: new Date(Date.UTC(year, monthIndex + 1, 1) + 36 * 60 * 60 * 1000),
  };
}

function localDateTime(date: string, time: string, timeZone: string) {
  const naive = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(naive.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(naive);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute));
  return new Date(naive.getTime() - (represented - naive.getTime()));
}

export async function getScheduleData(month = "") {
  const user = await requireUser();
  const manages = canAccess(user, "schedule.manage");
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { timeZone: true } });
  const bounds = monthBounds(month);
  const services = await prisma.servicePlan.findMany({
    where: { churchId: user.churchId, ...(manages ? {} : { status: "PUBLISHED" }), serviceAt: { gte: bounds.start, lt: bounds.end } },
    include: { attendanceSession: { select: { id: true } }, items: { select: { id: true } }, serviceSlots: { include: { ministryRole: true, proposals: { include: { person: true } }, assignments: { include: { person: true }, orderBy: { createdAt: "desc" } } }, orderBy: { sortOrder: "asc" } } },
    orderBy: { serviceAt: "asc" }, take: 64
  });
  const [memberships, people, templates, notifications] = await Promise.all([
    user.personId ? prisma.ministryMembership.findMany({ where: { churchId: user.churchId, personId: user.personId, isActive: true }, select: { ministryRoleId: true } }) : [],
    manages ? prisma.person.findMany({ where: { churchId: user.churchId, personType: "MEMBER", status: "ACTIVE" }, include: { ministryMemberships: { where: { isActive: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }) : [],
    manages ? prisma.serviceSlotTemplate.findMany({ where: { churchId: user.churchId, isActive: true }, orderBy: { sortOrder: "asc" } }) : [],
    prisma.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);
  return { user, manages, services, eligibleRoleIds: memberships.map((item) => item.ministryRoleId), people, templates, notifications, timeZone: church.timeZone };
}

export async function createScheduledServiceAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const user = await requirePermission("schedule.manage");
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { timeZone: true } });
  const validation = validateScheduledServiceDraft({
    title: String(formData.get("title") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    creationMode: String(formData.get("creationMode") ?? ""),
  });
  if (!validation.data) return formError("Revisa los campos indicados.", validation.fieldErrors);
  const { title, date, time, creationMode } = validation.data;
  const serviceAt = localDateTime(date, time, church.timeZone);
  if (!serviceAt) return formError("La fecha y hora no forman un servicio válido.", { date: "Selecciona una fecha válida.", time: "Selecciona una hora válida." });
  const requestedDay = new Intl.DateTimeFormat("en-CA", { timeZone: church.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(serviceAt);
  const [templates, previous] = await Promise.all([
    creationMode === "template" ? prisma.serviceSlotTemplate.findMany({ where: { churchId: user.churchId, isActive: true }, orderBy: { sortOrder: "asc" } }) : [],
    creationMode === "duplicate" ? prisma.servicePlan.findFirst({ where: { churchId: user.churchId, serviceAt: { lt: serviceAt } }, include: { items: { orderBy: { sortOrder: "asc" } }, serviceSlots: { orderBy: { sortOrder: "asc" } } }, orderBy: { serviceAt: "desc" } }) : null,
  ]);
  const slots = previous?.serviceSlots ?? templates;
  const result = await prisma.$transaction(async (tx) => {
    if (databaseProvider === "mysql") {
      await tx.$queryRawUnsafe("SELECT `id` FROM `Church` WHERE `id` = ? FOR UPDATE", user.churchId);
    } else {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.churchId}), hashtext(${requestedDay}))`;
    }
    const nearby = await tx.servicePlan.findMany({ where: { churchId: user.churchId, serviceAt: { gte: new Date(serviceAt.getTime() - 18 * 60 * 60 * 1000), lte: new Date(serviceAt.getTime() + 18 * 60 * 60 * 1000) } }, select: { id: true, title: true, serviceAt: true } });
    const existing = nearby.find((plan) => new Intl.DateTimeFormat("en-CA", { timeZone: church.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(plan.serviceAt) === requestedDay);
    if (existing) return { existing };
    const service = await tx.servicePlan.create({ data: {
      churchId: user.churchId, title, serviceAt, status: "DRAFT", topic: previous?.topic, slideThemeId: previous?.slideThemeId,
      serviceSlots: { create: slots.map((slot) => ({ churchId: user.churchId, ministryRoleId: slot.ministryRoleId, name: slot.name, sortOrder: slot.sortOrder })) },
      items: previous ? { create: previous.items.map((item) => ({ type: item.type, title: item.title, body: item.body, notes: item.notes, durationMinutes: item.durationMinutes, sortOrder: item.sortOrder, exportTags: databaseList(stringList(item.exportTags)), slideThemeId: item.slideThemeId })) } : undefined,
    }, select: { id: true } });
    return { service };
  });
  if (result.existing) return formError(`Ya existe el servicio “${result.existing.title}” en esa fecha.`, { date: "Esta fecha ya tiene un servicio." }, { href: `/services/${result.existing.id}?tab=resumen`, label: "Abrir servicio existente" });
  refresh();
  redirect(`/services/${result.service!.id}?tab=resumen`);
}

export async function applySlotTemplatesAction(formData: FormData) {
  const user = await requirePermission("schedule.manage");
  const servicePlanId = String(formData.get("servicePlanId") ?? "");
  const [plan, templates] = await Promise.all([
    prisma.servicePlan.findFirst({ where: { id: servicePlanId, churchId: user.churchId } }),
    prisma.serviceSlotTemplate.findMany({ where: { churchId: user.churchId, isActive: true }, orderBy: { sortOrder: "asc" } })
  ]);
  if (!plan) return formError("El servicio ya no está disponible.");
  await prisma.$transaction(templates.map((template) => prisma.serviceSlot.upsert({ where: { servicePlanId_name: { servicePlanId, name: template.name } }, create: { churchId: user.churchId, servicePlanId, ministryRoleId: template.ministryRoleId, name: template.name, sortOrder: template.sortOrder }, update: { ministryRoleId: template.ministryRoleId, sortOrder: template.sortOrder } })));
  refresh();
}

export async function proposeForSlotAction(formData: FormData) {
  const user = await requirePermission("schedule.propose");
  if (!user.personId) return formError("Tu cuenta debe estar vinculada con un perfil de miembro.");
  const serviceSlotId = String(formData.get("serviceSlotId") ?? "");
  const slot = await prisma.serviceSlot.findFirst({ where: { id: serviceSlotId, churchId: user.churchId, servicePlan: { status: "PUBLISHED", serviceAt: { gt: new Date() } }, ministryRole: { memberships: { some: { personId: user.personId, isActive: true } } } } });
  if (!slot) return formError("Este puesto no está disponible para tus cargos ministeriales.");
  await prisma.scheduleProposal.upsert({ where: { serviceSlotId_personId: { serviceSlotId, personId: user.personId } }, create: { churchId: user.churchId, serviceSlotId, personId: user.personId, notes: String(formData.get("notes") ?? "").trim() || null }, update: { status: "PENDING", notes: String(formData.get("notes") ?? "").trim() || null, reviewedAt: null } });
  refresh();
}

export async function withdrawProposalAction(formData: FormData) {
  const user = await requirePermission("schedule.propose");
  if (!user.personId) return formError("Tu cuenta no está vinculada con un perfil de miembro.");
  const proposal = await prisma.scheduleProposal.findFirst({ where: { id: String(formData.get("proposalId") ?? ""), churchId: user.churchId, personId: user.personId } });
  if (!proposal) return formError("La propuesta ya no está disponible.");
  await prisma.scheduleProposal.update({ where: { id: proposal.id }, data: { status: "WITHDRAWN" } });
  refresh();
}

export async function assignServiceSlotAction(formData: FormData) {
  const user = await requirePermission("schedule.manage");
  const serviceSlotId = String(formData.get("serviceSlotId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const kind = String(formData.get("kind")) === "BACKUP" ? "BACKUP" : "PRIMARY";
  const slot = await prisma.serviceSlot.findFirst({ where: { id: serviceSlotId, churchId: user.churchId, ministryRole: { memberships: { some: { personId, isActive: true } } } }, include: { servicePlan: true } });
  if (!slot) return formError("El miembro seleccionado no está habilitado para este puesto.", { personId: "Selecciona un miembro elegible." });
  await prisma.$transaction(async (tx) => {
    await tx.serviceAssignment.updateMany({ where: { serviceSlotId, kind, status: { in: [...activeAssignmentStatuses] } }, data: { status: "REPLACED", endedAt: new Date() } });
    await tx.serviceAssignment.create({ data: { churchId: user.churchId, serviceSlotId, personId, kind } });
    await tx.scheduleProposal.updateMany({ where: { serviceSlotId, personId }, data: { status: "APPROVED", reviewedAt: new Date() } });
  }, { isolationLevel: "Serializable" });
  await notifyPerson(personId, user.churchId, "Service assignment", `Please confirm ${kind.toLowerCase()} assignment for ${slot.name} on ${slot.servicePlan.serviceAt.toLocaleDateString()}.`);
  refresh();
}

export async function rejectProposalAction(formData: FormData) {
  const user = await requirePermission("schedule.manage");
  const proposal = await prisma.scheduleProposal.findFirst({ where: { id: String(formData.get("proposalId") ?? ""), churchId: user.churchId } });
  if (!proposal) return formError("La propuesta ya no está disponible.");
  await prisma.scheduleProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", reviewedAt: new Date() } });
  await notifyPerson(proposal.personId, user.churchId, "Schedule update", "Your service proposal was not selected this time.");
  refresh();
}

export async function respondToAssignmentAction(formData: FormData) {
  const user = await requireUser();
  if (!user.personId) return formError("Tu cuenta no está vinculada con un perfil de miembro.");
  const assignment = await prisma.serviceAssignment.findFirst({ where: { id: String(formData.get("assignmentId") ?? ""), churchId: user.churchId, personId: user.personId, status: "PENDING_CONFIRMATION" }, include: { serviceSlot: true } });
  if (!assignment) return formError("La asignación ya no está disponible o ya fue respondida.");
  const accepted = String(formData.get("response")) === "CONFIRMED";
  await prisma.serviceAssignment.update({ where: { id: assignment.id }, data: { status: accepted ? "CONFIRMED" : "DECLINED", confirmedAt: accepted ? new Date() : null, endedAt: accepted ? null : new Date() } });
  if (!accepted) {
    const coordinators = await prisma.user.findMany({ where: { churchId: user.churchId, role: "ADMIN", isActive: true }, select: { id: true } });
    await prisma.notification.createMany({ data: coordinators.map((coordinator) => ({ churchId: user.churchId, userId: coordinator.id, title: "Assignment declined", body: `${user.name} declined ${assignment.serviceSlot.name}.`, href: "/schedule" })) });
  }
  refresh();
}

export async function promoteBackupAction(formData: FormData) {
  const user = await requirePermission("schedule.manage");
  const serviceSlotId = String(formData.get("serviceSlotId") ?? "");
  const backup = await prisma.serviceAssignment.findFirst({ where: { churchId: user.churchId, serviceSlotId, kind: "BACKUP", status: "CONFIRMED" }, include: { serviceSlot: true }, orderBy: { createdAt: "desc" } });
  if (!backup) return formError("No hay un respaldo confirmado para promover.");
  await prisma.$transaction(async (tx) => {
    await tx.serviceAssignment.updateMany({ where: { serviceSlotId, kind: "PRIMARY", status: { in: [...activeAssignmentStatuses] } }, data: { status: "REPLACED", endedAt: new Date() } });
    await tx.serviceAssignment.update({ where: { id: backup.id }, data: { status: "REPLACED", endedAt: new Date() } });
    await tx.serviceAssignment.create({ data: { churchId: user.churchId, serviceSlotId, personId: backup.personId, kind: "PRIMARY", status: "CONFIRMED", confirmedAt: new Date() } });
  }, { isolationLevel: "Serializable" });
  await notifyPerson(backup.personId, user.churchId, "Promoted to primary", `You are now the primary for ${backup.serviceSlot.name}.`);
  refresh();
}

export async function setServiceScheduleStatusAction(formData: FormData) {
  const user = await requirePermission("schedule.manage");
  const servicePlanId = String(formData.get("servicePlanId") ?? "");
  const status = String(formData.get("status"));
  if (!["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"].includes(status)) return formError("El estado solicitado no es válido.");
  const plan = await prisma.servicePlan.findFirst({ where: { id: servicePlanId, churchId: user.churchId } });
  if (!plan) return formError("El servicio ya no está disponible.");
  await prisma.$transaction([
    prisma.servicePlan.update({ where: { id: servicePlanId }, data: { status: status as "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED", publishedAt: status === "PUBLISHED" ? new Date() : plan.publishedAt, completedAt: status === "COMPLETED" ? new Date() : null } }),
    ...(status === "COMPLETED" || status === "CANCELLED" ? [prisma.serviceAssignment.updateMany({ where: { serviceSlot: { servicePlanId }, status: { in: [...activeAssignmentStatuses] } }, data: { status: status === "COMPLETED" ? "COMPLETED" : "REPLACED", endedAt: new Date() } })] : [])
  ]);
  refresh();
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { id: String(formData.get("notificationId") ?? ""), userId: user.id }, data: { readAt: new Date() } });
  refresh();
}
