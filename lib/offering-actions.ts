"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireUser } from "@/lib/auth";
import { formError, type FormActionState } from "@/lib/form-state";
import { normalizeCurrencyCode, parseMoneyToMinor } from "@/lib/offering-money";
import { prisma } from "@/lib/prisma";

function refreshOfferings() {
  revalidatePath("/offerings");
  revalidatePath("/services");
  revalidatePath("/");
}

function validNote(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().slice(0, 500) || null;
}

export async function confirmOfferingAction(formData: FormData): Promise<FormActionState> {
  const user = await requirePermission("offerings.capture");
  const servicePlanId = String(formData.get("servicePlanId") ?? "");
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { currencyCode: true } });
  const amountMinor = parseMoneyToMinor(String(formData.get("amount") ?? ""), church.currencyCode);
  if (amountMinor === null) return formError("Ingresa un monto válido para la moneda configurada.", { amount: "Usa un número sin separadores de miles." });
  const service = await prisma.servicePlan.findFirst({ where: { id: servicePlanId, churchId: user.churchId, status: "COMPLETED" }, select: { id: true, offeringClosure: { select: { id: true } } } });
  if (!service) return formError("Solo se pueden confirmar ofrendas de servicios completados.");
  if (service.offeringClosure) return formError("Este servicio ya tiene una ofrenda confirmada. Usa la opción de corrección.");
  try {
    await prisma.offeringClosure.create({
      data: {
        churchId: user.churchId,
        servicePlanId,
        amountMinor,
        currencyCode: church.currencyCode,
        note: validNote(formData.get("note")),
        confirmedById: user.id,
        auditEvents: { create: { churchId: user.churchId, actorUserId: user.id, eventType: "CONFIRMED", newAmountMinor: amountMinor } },
      },
    });
  } catch {
    return formError("La ofrenda no pudo confirmarse; puede que otro usuario ya la haya registrado.");
  }
  refreshOfferings();
  return { status: "success", message: "La ofrenda quedó confirmada." };
}

export async function correctOfferingAction(formData: FormData): Promise<FormActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return formError("Solo un administrador puede corregir un cierre confirmado.");
  const offeringId = String(formData.get("offeringId") ?? "");
  const expectedUpdatedAt = new Date(String(formData.get("expectedUpdatedAt") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5 || reason.length > 500) return formError("Explica el motivo de la corrección.", { reason: "Escribe entre 5 y 500 caracteres." });
  const offering = await prisma.offeringClosure.findFirst({ where: { id: offeringId, churchId: user.churchId } });
  if (!offering) return formError("El cierre de ofrenda ya no está disponible.");
  const amountMinor = parseMoneyToMinor(String(formData.get("amount") ?? ""), offering.currencyCode);
  if (amountMinor === null) return formError("Ingresa un monto válido para la moneda del cierre.", { amount: "Usa un número sin separadores de miles." });
  if (amountMinor === offering.amountMinor) return formError("El monto corregido debe ser diferente al actual.", { amount: "Cambia el monto antes de guardar." });
  if (Number.isNaN(expectedUpdatedAt.getTime())) return formError("Recarga la página antes de corregir este cierre.");
  const changed = await prisma.$transaction(async (tx) => {
    const update = await tx.offeringClosure.updateMany({
      where: { id: offering.id, churchId: user.churchId, updatedAt: expectedUpdatedAt },
      data: { amountMinor },
    });
    if (update.count !== 1) return false;
    await tx.offeringAuditEvent.create({ data: { churchId: user.churchId, offeringClosureId: offering.id, actorUserId: user.id, eventType: "CORRECTED", previousAmountMinor: offering.amountMinor, newAmountMinor: amountMinor, reason } });
    return true;
  });
  if (!changed) return formError("Otro usuario modificó este cierre. Recarga la página y revisa el monto actual.");
  refreshOfferings();
  return { status: "success", message: "La corrección quedó registrada en la auditoría." };
}

export async function updateOfferingCurrencyAction(formData: FormData): Promise<FormActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return formError("Solo un administrador puede configurar la moneda.");
  const currencyCode = normalizeCurrencyCode(String(formData.get("currencyCode") ?? ""));
  if (!currencyCode) return formError("Ingresa un código de moneda ISO válido.", { currencyCode: "Ejemplos: MXN, USD, EUR." });
  const existing = await prisma.offeringClosure.count({ where: { churchId: user.churchId } });
  if (existing) return formError("La moneda ya no puede cambiarse porque existen ofrendas confirmadas.");
  await prisma.church.update({ where: { id: user.churchId }, data: { currencyCode } });
  revalidatePath("/", "layout");
  return { status: "success", message: `La moneda de la iglesia ahora es ${currencyCode}.` };
}
