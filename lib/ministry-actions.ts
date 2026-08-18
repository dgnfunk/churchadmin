"use server";

import { revalidatePath } from "next/cache";
import type { Permission } from "@/lib/domain";
import { requirePermission } from "@/lib/auth";
import { normalizedPermanentPermissions, permissions } from "@/lib/permissions";
import { ministryRolePreset } from "@/lib/ministry-role-presets";
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
  return { roles: roles.map((role) => ({ ...role, basePermissions: normalizedPermanentPermissions(stringList(role.basePermissions)), servicePermissions: stringList(role.servicePermissions).filter((permission) => !permission.startsWith("offerings.")) })), people, templates };
}

export async function createMinistryRolePresetAction(formData: FormData) {
  const user = await requirePermission("ministry.manage");
  const preset = ministryRolePreset(String(formData.get("preset") ?? ""));
  if (!preset) return formError("El cargo predefinido no es válido.");
  const existing = await prisma.ministryRole.findFirst({ where: { churchId: user.churchId, name: equalsText(preset.name) } });
  if (existing) {
    const basePermissions = new Set(normalizedPermanentPermissions(stringList(existing.basePermissions)));
    preset.basePermissions.forEach((permission) => basePermissions.add(permission));
    await prisma.ministryRole.update({ where: { id: existing.id }, data: { description: existing.description || preset.description, color: existing.color || preset.color, basePermissions: databaseList([...basePermissions]), isActive: true } });
  } else {
    const last = await prisma.ministryRole.findFirst({ where: { churchId: user.churchId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await prisma.ministryRole.create({ data: { churchId: user.churchId, name: preset.name, description: preset.description, color: preset.color, basePermissions: databaseList(preset.basePermissions), servicePermissions: databaseList([]), isActive: true, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  }
  refresh();
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
  const servicePermissions = selectedPermissions(formData, "servicePermissions").filter((permission) => !permission.startsWith("offerings."));
  const data = { name, description: description || null, color: requestedColor, basePermissions: databaseList(selectedPermissions(formData, "basePermissions")), servicePermissions: databaseList(servicePermissions), isActive: formData.get("isActive") === "on" };
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

export async function saveMinistryMembershipsAction(formData: FormData) {
  const user = await requirePermission("ministry.manage");
  const personId = String(formData.get("personId") ?? "");
  const requestedRoleIds = new Set(formData.getAll("ministryRoleIds").map(String));
  const [person, roles] = await Promise.all([
    prisma.person.findFirst({ where: { id: personId, churchId: user.churchId, personType: "MEMBER", status: "ACTIVE" }, select: { id: true } }),
    prisma.ministryRole.findMany({ where: { churchId: user.churchId, isActive: true }, select: { id: true } })
  ]);
  if (!person) return formError("El miembro ya no está disponible.");
  const validRoleIds = new Set(roles.map((role) => role.id));
  if ([...requestedRoleIds].some((roleId) => !validRoleIds.has(roleId))) return formError("Uno de los cargos seleccionados ya no está disponible.");
  await prisma.$transaction(roles.map((role) => prisma.ministryMembership.upsert({
    where: { personId_ministryRoleId: { personId, ministryRoleId: role.id } },
    create: { churchId: user.churchId, personId, ministryRoleId: role.id, isActive: requestedRoleIds.has(role.id) },
    update: { isActive: requestedRoleIds.has(role.id) }
  })));
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
