"use server";

import { revalidatePath } from "next/cache";
import { requireScope } from "@/lib/auth";
import type { ContentLibraryItem } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { databaseList, stringList } from "@/lib/database-compat";

const normalizeTitle = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function serialize(item: { id: string; churchId: string; type: ContentLibraryItem["type"]; title: string; body: string; notes: string | null; exportTags: unknown; lastUsedAt: Date | null }): ContentLibraryItem { return { id: item.id, churchId: item.churchId, type: item.type, title: item.title, body: item.body, notes: item.notes ?? undefined, exportTags: stringList(item.exportTags) as ContentLibraryItem["exportTags"], lastUsedAt: item.lastUsedAt?.toISOString() }; }

export async function listContentLibrary() { const user = await requireScope("services"); const rows = await prisma.contentLibraryItem.findMany({ where: { churchId: user.churchId, archivedAt: null }, orderBy: [{ lastUsedAt: "desc" }, { title: "asc" }] }); return rows.map(serialize); }

export async function saveServiceItemToLibrary(input: { itemId: string }) { const user = await requireScope("services"); const item = await prisma.serviceItem.findFirst({ where: { id: input.itemId, servicePlan: { churchId: user.churchId } } }); if (!item) throw new Error("Service item was not found."); const normalizedTitle = normalizeTitle(item.title); const exportTags = databaseList(stringList(item.exportTags)); const saved = await prisma.contentLibraryItem.upsert({ where: { churchId_type_normalizedTitle: { churchId: user.churchId, type: item.type, normalizedTitle } }, update: { title: item.title, body: item.body, notes: item.notes, exportTags, archivedAt: null }, create: { churchId: user.churchId, type: item.type, title: item.title, normalizedTitle, body: item.body, notes: item.notes, exportTags } }); revalidatePath("/services"); return serialize(saved); }

export async function addLibraryItemToService(input: { libraryItemId: string; servicePlanId: string }) { const user = await requireScope("services"); const [libraryItem, plan] = await Promise.all([prisma.contentLibraryItem.findFirst({ where: { id: input.libraryItemId, churchId: user.churchId, archivedAt: null } }), prisma.servicePlan.findFirst({ where: { id: input.servicePlanId, churchId: user.churchId } })]); if (!libraryItem || !plan) throw new Error("Library item or service was not found."); const last = await prisma.serviceItem.findFirst({ where: { servicePlanId: plan.id }, orderBy: { sortOrder: "desc" } }); await prisma.$transaction([prisma.serviceItem.create({ data: { servicePlanId: plan.id, type: libraryItem.type, title: libraryItem.title, body: libraryItem.body, notes: libraryItem.notes, exportTags: databaseList(stringList(libraryItem.exportTags)), sortOrder: (last?.sortOrder ?? 0) + 1 } }), prisma.contentLibraryItem.update({ where: { id: libraryItem.id }, data: { lastUsedAt: new Date() } })]); revalidatePath("/services"); }
