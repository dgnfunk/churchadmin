"use server";

import { revalidatePath } from "next/cache";
import type { Permission } from "@/lib/domain";
import { requirePermission } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formError } from "@/lib/form-state";
import { databaseList, equalsText, stringList } from "@/lib/database-compat";

const validPermission = new Set<string>(permissions);
const selectedPermissions = (data: FormData, field: string) => data.getAll(field).map(String).filter((value): value is Permission => validPermission.has(value));
const refresh = () => { revalidatePath("/ministry"); revalidatePath("/schedule"); revalidatePath("/users"); };

export async function getMinistryManagementData() {
  const user = await requirePermission("ministry.manage");
  const [roles, people, templates] = await Promise.all([
    prisma.ministryRole.findMany({ where: { churchId: user.churchId }, include: { memberships: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.person.findMany({ where: { churchId: user.churchId, personType: "MEMBER", status: "ACTIVE" }, include: { ministryMemberships: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.serviceSlotTemplate.findMany({ where: { churchId: user.churchId }, include: { ministryRole: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
  ]);
  return { roles: roles.map((role) => ({ ...role, basePermissions: stringList(role.basePermissions), servicePermissions: stringList(role.servicePermissions) })), people, templates };
}

export async function saveMinistryRoleAction(formData: FormData) {
  const user = await requirePermission("ministry.manage");
  const id = String(formData.get("roleId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 100) return formError("El nombre del cargo debe tener entre 2 y 100 caracteres.", { name: "El nombre es obligatorio." });
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 500) return formError("La descripción no puede exceder 500 caracteres.", { description: "Reduce la descripción." });
  const requestedColor = String(formData.get("color") ?? "#0f766e");
  if (!/^#[0-9a-f]{6}$/i.test(requestedColor)) return formError("Selecciona un color válido.", { color: "El color debe usar formato hexadecimal." });
  const duplicate = await prisma.ministryRole.findFirst({ where: { churchId: user.churchId, name: equalsText(name), ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (duplicate) return formError("Ya existe un cargo con ese nombre.", { name: "Usa un nombre diferente." });
  const data = { name, description: description || null, color: requestedColor, basePermissions: databaseList(selectedPermissions(formData, "basePermissions")), servicePermissions: databaseList(selectedPermissions(formData, "servicePermissions")), isActive: formData.get("isActive") === "on" };
  if (id) {
    const role = await prisma.ministryRole.findFirst({ where: { id, churchId: user.churchId } });
    if (!role) return formError("El cargo ministerial ya no está disponible.");
    await prisma.ministryRole.update({ where: { id }, data });
  } else {
    const last = await prisma.ministryRole.findFirst({ where: { churchId: user.churchId }, orderBy: { sortOrder: "desc" } });
    await prisma.ministryRole.create({ data: { churchId: user.churchId, ...data, isActive: true, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  }
  refresh();
}

export async function setMinistryMembershipAction(formData: FormData) {
  const user = await requirePermission("ministry.manage");
  const personId = String(formData.get("personId") ?? "");
  const ministryRoleId = String(formData.get("ministryRoleId") ?? "");
  const [person, role] = await Promise.all([
    prisma.person.findFirst({ where: { id: personId, churchId: user.churchId } }),
    prisma.ministryRole.findFirst({ where: { id: ministryRoleId, churchId: user.churchId } })
  ]);
  if (!person || !role) return formError("El miembro o el cargo ya no está disponible.");
  await prisma.ministryMembership.upsert({ where: { personId_ministryRoleId: { personId, ministryRoleId } }, create: { churchId: user.churchId, personId, ministryRoleId }, update: { isActive: formData.get("isActive") === "on" } });
  refresh();
}

export async function saveSlotTemplateAction(formData: FormData) {
  const user = await requirePermission("ministry.manage");
  const name = String(formData.get("name") ?? "").trim();
  const ministryRoleId = String(formData.get("ministryRoleId") ?? "");
  const role = await prisma.ministryRole.findFirst({ where: { id: ministryRoleId, churchId: user.churchId } });
  if (name.length < 2 || name.length > 100) return formError("El nombre del puesto debe tener entre 2 y 100 caracteres.", { name: "El nombre es obligatorio." });
  if (!role) return formError("Selecciona un cargo ministerial válido.", { ministryRoleId: "El cargo es obligatorio." });
  const last = await prisma.serviceSlotTemplate.findFirst({ where: { churchId: user.churchId }, orderBy: { sortOrder: "desc" } });
  await prisma.serviceSlotTemplate.upsert({ where: { churchId_name: { churchId: user.churchId, name } }, create: { churchId: user.churchId, name, ministryRoleId, sortOrder: (last?.sortOrder ?? 0) + 1 }, update: { ministryRoleId, isActive: true } });
  refresh();
}
