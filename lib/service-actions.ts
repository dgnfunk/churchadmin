"use server";

import { revalidatePath } from "next/cache";
import type { ExportTag, ServiceItemType } from "@/lib/domain";
import { requirePermission, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeServicePlan, servicePlanInclude } from "@/lib/service-serialization";
import { moveMediaToTrash } from "@/lib/file-storage";
import { canAccess, hasServicePermission } from "@/lib/permissions";
import { databaseList, stringList } from "@/lib/database-compat";

async function requirePlanPermission(servicePlanId: string, permission: "services.view" | "services.content.edit") {
  const user = await requireUser();
  const owned = await prisma.servicePlan.findFirst({ where: { id: servicePlanId, churchId: user.churchId }, select: { id: true } });
  if (!owned || (!canAccess(user, permission) && !await hasServicePermission(user, permission, servicePlanId))) throw new Error("You do not have permission for this service.");
  return user;
}

async function requireItemPermission(itemId: string) {
  const user = await requireUser();
  const item = await prisma.serviceItem.findFirst({ where: { id: itemId, servicePlan: { churchId: user.churchId } }, select: { servicePlanId: true } });
  if (!item || (!canAccess(user, "services.content.edit") && !await hasServicePermission(user, "services.content.edit", item.servicePlanId))) throw new Error("You do not have permission to edit this service item.");
  return user;
}

async function findOwnedServicePlan(id: string, churchId: string) {
  const plan = await prisma.servicePlan.findFirst({
    where: { id, churchId },
    include: { ...servicePlanInclude, serviceSlots: true }
  });
  if (!plan) throw new Error("Service plan was not found.");
  return serializeServicePlan(plan);
}

async function assertOwnedItem(id: string, churchId: string) {
  const item = await prisma.serviceItem.findFirst({
    where: { id, servicePlan: { churchId } },
    include: { mediaAssets: true }
  });
  if (!item) throw new Error("Service item was not found.");
  return item;
}

function nextSundayDate(from: Date) {
  const date = new Date(from);
  const daysUntilSunday = (7 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  date.setUTCHours(10, 0, 0, 0);
  return date;
}

function refreshServices() {
  revalidatePath("/", "layout");
  revalidatePath("/services");
}

async function findServiceOnUtcDay(churchId: string, serviceAt: Date, excludeId?: string) {
  const start = new Date(serviceAt); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  return prisma.servicePlan.findFirst({ where: { churchId, serviceAt: { gte: start, lt: end }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, title: true } });
}

function validateServiceItemInput(input: { title: string; body: string; notes?: string; durationMinutes?: number }) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 1 || title.length > 160) throw new Error("El título debe tener entre 1 y 160 caracteres.");
  if (body.length < 1 || body.length > 100_000) throw new Error("El contenido es obligatorio y no puede exceder 100,000 caracteres.");
  if ((input.notes?.length ?? 0) > 10_000) throw new Error("Las notas no pueden exceder 10,000 caracteres.");
  if (input.durationMinutes != null && (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0 || input.durationMinutes > 1440)) throw new Error("La duración debe estar entre 0 y 1,440 minutos.");
  return { title, body };
}

export async function saveServicePlanDetails(input: {
  servicePlanId: string;
  title: string;
  topic?: string;
  serviceAt: string;
  slideThemeId?: string;
}) {
  const user = await requirePlanPermission(input.servicePlanId, "services.content.edit");
  await findOwnedServicePlan(input.servicePlanId, user.churchId);
  const serviceAt = new Date(input.serviceAt);
  const title = input.title.trim();
  const topic = input.topic?.trim() ?? "";
  if (title.length < 2 || title.length > 120) throw new Error("El nombre del servicio debe tener entre 2 y 120 caracteres.");
  if (topic.length > 500) throw new Error("El tema no puede exceder 500 caracteres.");
  if (Number.isNaN(serviceAt.getTime())) throw new Error("La fecha del servicio no es válida.");
  const existing = await findServiceOnUtcDay(user.churchId, serviceAt, input.servicePlanId);
  if (existing) throw new Error(`Ya existe el servicio “${existing.title}” en esa fecha.`);
  if (input.slideThemeId) {
    const theme = await prisma.slideTheme.findFirst({ where: { id: input.slideThemeId, churchId: user.churchId }, select: { id: true } });
    if (!theme) throw new Error("El tema de diapositivas ya no está disponible.");
  }

  await prisma.servicePlan.update({
    where: { id: input.servicePlanId },
    data: {
      title,
      topic: topic || null,
      serviceAt,
      slideThemeId: input.slideThemeId || null
    }
  });
  refreshServices();
  return findOwnedServicePlan(input.servicePlanId, user.churchId);
}

export async function duplicateServicePlan(input: { servicePlanId: string; itemIds?: string[] }) {
  const user = await requirePermission("services.content.edit");
  const current = await prisma.servicePlan.findFirst({
    where: { id: input.servicePlanId, churchId: user.churchId },
    include: { ...servicePlanInclude, serviceSlots: true }
  });
  if (!current) throw new Error("El servicio ya no está disponible.");

  const serviceAt = nextSundayDate(current.serviceAt);
  const duplicate = await findServiceOnUtcDay(user.churchId, serviceAt);
  if (duplicate) throw new Error(`Ya existe el servicio “${duplicate.title}” en esa fecha.`);
  const selected = input.itemIds ? new Set(input.itemIds) : null;
  const items = current.items.filter((item) => !selected || selected.has(item.id));
  const nextDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(serviceAt);

  const plan = await prisma.servicePlan.create({
    data: {
      churchId: user.churchId,
      title: `${current.title.replace(/\s-\s[A-Z][a-z]{2}\s\d{1,2}$/, "")} - ${nextDate}`,
      topic: current.topic,
      serviceAt,
      slideThemeId: current.slideThemeId,
      status: "DRAFT",
      serviceSlots: {
        create: current.serviceSlots.map((slot) => ({ churchId: user.churchId, ministryRoleId: slot.ministryRoleId, name: slot.name, sortOrder: slot.sortOrder }))
      },
      items: {
        create: items.map((item, index) => ({
          type: item.type,
          title: item.title,
          body: item.body,
          notes: item.notes,
          durationMinutes: item.durationMinutes,
          sortOrder: index + 1,
          exportTags: databaseList(stringList(item.exportTags))
          ,slideThemeId: item.slideThemeId
        }))
      }
    },
    include: servicePlanInclude
  });
  refreshServices();
  return serializeServicePlan(plan);
}

export async function createNextWeekService(input: { servicePlanId: string }) {
  return duplicateServicePlan(input);
}

export async function createBlankService(input: { fromServiceAt: string }) {
  const user = await requirePermission("services.content.edit");
  const serviceAt = nextSundayDate(new Date(input.fromServiceAt));
  if (Number.isNaN(serviceAt.getTime())) throw new Error("La fecha base del servicio no es válida.");
  const duplicate = await findServiceOnUtcDay(user.churchId, serviceAt);
  if (duplicate) throw new Error(`Ya existe el servicio “${duplicate.title}” en esa fecha.`);
  const plan = await prisma.servicePlan.create({
    data: { churchId: user.churchId, title: "Sunday Worship", topic: null, serviceAt, status: "DRAFT" },
    include: servicePlanInclude
  });
  refreshServices();
  return serializeServicePlan(plan);
}

export async function deleteServicePlan(input: { servicePlanId: string }) {
  const user = await requirePermission("services.content.edit");
  await findOwnedServicePlan(input.servicePlanId, user.churchId);
  const planCount = await prisma.servicePlan.count({ where: { churchId: user.churchId } });
  if (planCount <= 1) throw new Error("Debe permanecer al menos un servicio.");
  const assets = await prisma.mediaAsset.findMany({ where: { serviceItem: { servicePlanId: input.servicePlanId } }, select: { storageKey: true } });
  await Promise.all(assets.map((asset) => moveMediaToTrash(asset.storageKey)));
  await prisma.servicePlan.delete({ where: { id: input.servicePlanId } });
  refreshServices();
  return { id: input.servicePlanId };
}

export async function getServicePlanAction(input: { servicePlanId: string }) {
  const user = await requirePlanPermission(input.servicePlanId, "services.view");
  return findOwnedServicePlan(input.servicePlanId, user.churchId);
}

export async function addServiceItem(input: {
  servicePlanId: string;
  type: ServiceItemType;
  title: string;
  body: string;
  notes?: string;
  durationMinutes?: number;
  exportTags: ExportTag[];
  slideThemeId?: string;
}) {
  const user = await requirePlanPermission(input.servicePlanId, "services.content.edit");
  await findOwnedServicePlan(input.servicePlanId, user.churchId);
  const { title, body } = validateServiceItemInput(input);
  if (input.slideThemeId) {
    const slideTheme = await prisma.slideTheme.findFirst({ where: { id: input.slideThemeId, churchId: user.churchId }, select: { id: true } });
    if (!slideTheme) throw new Error("El tema de diapositivas ya no está disponible.");
  }

  const lastItem = await prisma.serviceItem.findFirst({
    where: { servicePlanId: input.servicePlanId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  await prisma.serviceItem.create({
    data: {
      servicePlanId: input.servicePlanId,
      type: input.type,
      title,
      body,
      notes: input.notes?.trim() || null,
      durationMinutes: input.durationMinutes,
      sortOrder: (lastItem?.sortOrder ?? 0) + 1,
      exportTags: databaseList(input.exportTags.length ? input.exportTags : ["INTERNAL"])
      ,slideThemeId: input.slideThemeId || null
    }
  });
  refreshServices();
  return findOwnedServicePlan(input.servicePlanId, user.churchId);
}

export async function updateServiceItem(input: {
  itemId: string;
  type: ServiceItemType;
  title: string;
  body: string;
  notes?: string;
  durationMinutes?: number;
  exportTags: ExportTag[];
  slideThemeId?: string;
}) {
  const user = await requireItemPermission(input.itemId);
  const item = await assertOwnedItem(input.itemId, user.churchId);
  const { title, body } = validateServiceItemInput(input);
  if (input.slideThemeId) {
    const slideTheme = await prisma.slideTheme.findFirst({ where: { id: input.slideThemeId, churchId: user.churchId }, select: { id: true } });
    if (!slideTheme) throw new Error("El tema de diapositivas ya no está disponible.");
  }
  await prisma.serviceItem.update({
    where: { id: item.id },
    data: {
      type: input.type,
      title,
      body,
      notes: input.notes?.trim() || null,
      durationMinutes: input.durationMinutes,
      exportTags: databaseList(input.exportTags.length ? input.exportTags : ["INTERNAL"])
      ,slideThemeId: input.slideThemeId || null
    }
  });
  refreshServices();
  return findOwnedServicePlan(item.servicePlanId, user.churchId);
}

export async function duplicateServiceItem(input: { itemId: string }) {
  const user = await requireItemPermission(input.itemId);
  const item = await assertOwnedItem(input.itemId, user.churchId);
  const planItems = await prisma.serviceItem.findMany({
    where: { servicePlanId: item.servicePlanId },
    orderBy: { sortOrder: "asc" }
  });
  const insertAt = planItems.findIndex((candidate) => candidate.id === item.id) + 1;
  await prisma.$transaction(async (tx) => {
    await Promise.all(planItems.slice(insertAt).map((candidate) =>
      tx.serviceItem.update({ where: { id: candidate.id }, data: { sortOrder: candidate.sortOrder + 1 } })
    ));
    await tx.serviceItem.create({
      data: {
        servicePlanId: item.servicePlanId,
        type: item.type,
        title: `${item.title} (copia)`.slice(0, 160),
        body: item.body,
        notes: item.notes,
        durationMinutes: item.durationMinutes,
        sortOrder: item.sortOrder + 1,
        exportTags: databaseList(stringList(item.exportTags))
        ,slideThemeId: item.slideThemeId
      }
    });
  });
  refreshServices();
  return findOwnedServicePlan(item.servicePlanId, user.churchId);
}

export async function deleteServiceItem(input: { itemId: string }) {
  const user = await requireItemPermission(input.itemId);
  const item = await assertOwnedItem(input.itemId, user.churchId);
  await prisma.$transaction(async (tx) => {
    await tx.serviceItem.delete({ where: { id: item.id } });
    const remaining = await tx.serviceItem.findMany({
      where: { servicePlanId: item.servicePlanId },
      orderBy: { sortOrder: "asc" },
      select: { id: true }
    });
    await Promise.all(remaining.map((candidate, index) =>
      tx.serviceItem.update({ where: { id: candidate.id }, data: { sortOrder: index + 1 } })
    ));
  });
  refreshServices();
  return findOwnedServicePlan(item.servicePlanId, user.churchId);
}

export async function reorderServiceItems(input: { servicePlanId: string; itemIds: string[] }) {
  const user = await requirePlanPermission(input.servicePlanId, "services.content.edit");
  const plan = await findOwnedServicePlan(input.servicePlanId, user.churchId);
  const existing = new Set(plan.items.map((item) => item.id));
  if (input.itemIds.length !== existing.size || input.itemIds.some((id) => !existing.has(id))) {
    throw new Error("El orden de los elementos está incompleto o no es válido.");
  }
  await prisma.$transaction(input.itemIds.map((id, index) =>
    prisma.serviceItem.update({ where: { id }, data: { sortOrder: index + 1 } })
  ));
  refreshServices();
  return findOwnedServicePlan(input.servicePlanId, user.churchId);
}
