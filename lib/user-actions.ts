"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { formError } from "@/lib/form-state";

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export async function getUsers() {
  const currentUser = await requirePermission("users.manage");
  const [users, people] = await Promise.all([
    prisma.user.findMany({ where: { churchId: currentUser.churchId }, include: { person: { include: { ministryMemberships: { where: { isActive: true }, include: { ministryRole: true } } } } }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.person.findMany({ where: { churchId: currentUser.churchId, personType: "MEMBER", status: "ACTIVE" }, include: { user: { select: { id: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })
  ]);
  return { users, people };
}

export async function createUserAction(formData: FormData) {
  const currentUser = await requirePermission("users.manage");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role")) === "ADMIN" ? "ADMIN" : "MEMBER";
  const personId = role === "MEMBER" ? String(formData.get("personId") ?? "") : null;
  if (name.length < 2 || name.length > 120) return formError("Escribe un nombre válido de entre 2 y 120 caracteres.", { name: "El nombre es obligatorio." });
  if (!validEmail(email) || email.length > 254) return formError("Escribe un correo electrónico válido.", { email: "El correo no tiene un formato válido." });
  if (password.length < 8 || password.length > 128) return formError("La contraseña debe tener entre 8 y 128 caracteres.", { password: "Usa al menos 8 caracteres." });
  if (await prisma.user.findFirst({ where: { churchId: currentUser.churchId, email }, select: { id: true } })) return formError("Ya existe una cuenta con ese correo.", { email: "Este correo ya está registrado." });
  if (personId && !await prisma.person.findFirst({ where: { id: personId, churchId: currentUser.churchId, personType: "MEMBER", user: null } })) return formError("La persona seleccionada no existe o ya tiene una cuenta.", { personId: "Selecciona otro miembro." });
  if (role === "MEMBER" && !personId) return formError("Las cuentas de miembro deben vincularse con una persona.", { personId: "Selecciona un miembro." });
  await prisma.user.create({ data: { churchId: currentUser.churchId, name, email, role, personId, passwordHash: hashPassword(password), mustChangePassword: true } });
  revalidatePath("/users");
}

export async function updateUserAction(formData: FormData) {
  const currentUser = await requirePermission("users.manage");
  const userId = String(formData.get("userId") ?? "");
  const target = await prisma.user.findFirst({ where: { id: userId, churchId: currentUser.churchId } });
  if (!target) return formError("La cuenta ya no está disponible.");
  const role = String(formData.get("role")) === "ADMIN" ? "ADMIN" : "MEMBER";
  const isActive = formData.get("isActive") === "on";
  const personId = role === "MEMBER" ? String(formData.get("personId") ?? "") || null : null;
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) return formError("Escribe un nombre válido de entre 2 y 120 caracteres.", { name: "El nombre es obligatorio." });
  if (role === "MEMBER" && !personId) return formError("Las cuentas de miembro deben vincularse con una persona.", { personId: "Selecciona un miembro." });
  if (personId && !await prisma.person.findFirst({ where: { id: personId, churchId: currentUser.churchId, personType: "MEMBER", OR: [{ user: null }, { user: { id: target.id } }] } })) return formError("La persona seleccionada no existe o ya tiene otra cuenta.", { personId: "Selecciona otro miembro." });
  if (target.id === currentUser.id && (!isActive || role !== "ADMIN")) return formError("No puedes desactivar ni retirar el rol administrador de tu propia cuenta.");
  if (target.role === "ADMIN" && (role !== "ADMIN" || !isActive)) {
    const admins = await prisma.user.count({ where: { churchId: currentUser.churchId, role: "ADMIN", isActive: true } });
    if (admins <= 1) return formError("Debe permanecer al menos una cuenta administradora activa.");
  }
  await prisma.user.update({ where: { id: target.id }, data: { name, role, personId, isActive } });
  if (!isActive) await prisma.session.deleteMany({ where: { userId: target.id } });
  revalidatePath("/users"); revalidatePath("/", "layout");
}

export async function resetUserPasswordAction(formData: FormData) {
  const currentUser = await requirePermission("users.manage");
  const password = String(formData.get("password") ?? "");
  const target = await prisma.user.findFirst({ where: { id: String(formData.get("userId") ?? ""), churchId: currentUser.churchId } });
  if (!target) return formError("La cuenta ya no está disponible.");
  if (password.length < 8 || password.length > 128) return formError("La contraseña debe tener entre 8 y 128 caracteres.", { password: "Usa al menos 8 caracteres." });
  await prisma.$transaction([prisma.user.update({ where: { id: target.id }, data: { passwordHash: hashPassword(password), isActive: true, mustChangePassword: true } }), prisma.session.deleteMany({ where: { userId: target.id } })]);
  revalidatePath("/users");
}

export async function revokeUserSessionsAction(formData: FormData) {
  const currentUser = await requirePermission("users.manage");
  const target = await prisma.user.findFirst({ where: { id: String(formData.get("userId") ?? ""), churchId: currentUser.churchId } });
  if (!target) return formError("La cuenta ya no está disponible.");
  await prisma.session.deleteMany({ where: { userId: target.id } }); revalidatePath("/users");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const currentUser = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8 || password.length > 128) return formError("La contraseña debe tener entre 8 y 128 caracteres.", { password: "Usa al menos 8 caracteres." });
  await prisma.$transaction([prisma.user.update({ where: { id: currentUser.id }, data: { passwordHash: hashPassword(password), mustChangePassword: false } }), prisma.session.deleteMany({ where: { userId: currentUser.id } })]);
  redirect("/login");
}
