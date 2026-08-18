"use server";

import type { CommunicationChannel, CommunicationTemplateStatus, Prisma, SocialProvider } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { encryptCredentials } from "@/lib/credential-crypto";
import { loadYoutubeMetadata, metaTemplateBody } from "@/lib/communication-content";
import { materializeCampaignDeliveries } from "@/lib/communication-deliveries";
import { requirePermission } from "@/lib/auth";
import { listWhatsAppTemplates, submitWhatsAppTemplate, verifyMetaConnection } from "@/lib/meta-api";
import { prisma } from "@/lib/prisma";
import { databaseList, stringList } from "@/lib/database-compat";

const refresh = () => { revalidatePath("/communications"); revalidatePath("/services"); };
const channels = new Set<CommunicationChannel>(["WHATSAPP", "FACEBOOK", "INSTAGRAM"]);
const providers = new Set<SocialProvider>(["WHATSAPP", "FACEBOOK", "INSTAGRAM"]);
const templateStatuses = new Set<CommunicationTemplateStatus>(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAUSED", "DISABLED"]);
const text = (data: FormData, key: string, required = false) => { const value = String(data.get(key) ?? "").trim(); if (required && !value) throw new Error(`El campo ${key} es obligatorio.`); return value; };
const selectedChannels = (data: FormData) => data.getAll("channels").map(String).filter((value): value is CommunicationChannel => channels.has(value as CommunicationChannel));

function localDateTime(date: string, time: string, timeZone: string) {
  const naive = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(naive.getTime())) throw new Error("La fecha y hora no son válidas.");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(naive);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
  return new Date(naive.getTime() - (represented - naive.getTime()));
}

export async function saveSocialConnectionAction(formData: FormData) {
  const user = await requirePermission("communications.connections.manage");
  const provider = text(formData, "provider", true) as SocialProvider;
  if (!providers.has(provider)) throw new Error("El proveedor no es válido.");
  const externalAccountId = text(formData, "externalAccountId", true);
  const accessToken = text(formData, "accessToken");
  const phoneNumberId = text(formData, "phoneNumberId");
  if (provider === "WHATSAPP" && !phoneNumberId) throw new Error("El Phone Number ID es obligatorio para WhatsApp.");
  const existing = await prisma.socialConnection.findUnique({ where: { churchId_provider_externalAccountId: { churchId: user.churchId, provider, externalAccountId } } });
  if (!accessToken && !existing?.encryptedCredentials) throw new Error("Ingresa un access token para conectar la cuenta.");
  const connection = await prisma.socialConnection.upsert({
    where: { churchId_provider_externalAccountId: { churchId: user.churchId, provider, externalAccountId } },
    create: { churchId: user.churchId, provider, externalAccountId, displayName: text(formData, "displayName", true), encryptedCredentials: encryptCredentials({ accessToken }), metadata: provider === "WHATSAPP" ? { phoneNumberId } : {}, status: "DISCONNECTED" },
    update: { displayName: text(formData, "displayName", true), ...(accessToken ? { encryptedCredentials: encryptCredentials({ accessToken }) } : {}), metadata: provider === "WHATSAPP" ? { phoneNumberId } : existing?.metadata ?? {}, status: "DISCONNECTED", lastError: null },
  });
  try {
    const metadata = await verifyMetaConnection(connection);
    await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: "CONNECTED", verifiedAt: new Date(), lastError: null, metadata: { ...((connection.metadata ?? {}) as object), verification: metadata } as Prisma.InputJsonValue } });
  } catch (error) {
    await prisma.socialConnection.update({ where: { id: connection.id }, data: { status: "ERROR", lastError: error instanceof Error ? error.message : "No se pudo verificar la cuenta." } });
    throw error;
  }
  refresh();
}

export async function disconnectSocialConnectionAction(formData: FormData) {
  const user = await requirePermission("communications.connections.manage");
  await prisma.socialConnection.updateMany({ where: { id: text(formData, "connectionId", true), churchId: user.churchId }, data: { status: "DISCONNECTED", encryptedCredentials: null, verifiedAt: null } });
  refresh();
}

export async function saveCommunicationConsentAction(formData: FormData) {
  const user = await requirePermission("communications.consent.manage");
  const person = await prisma.person.findFirst({ where: { id: text(formData, "personId", true), churchId: user.churchId }, select: { id: true, normalizedPhone: true } });
  if (!person?.normalizedPhone) throw new Error("La persona necesita un teléfono válido antes de registrar consentimiento.");
  const status = text(formData, "status", true);
  if (!new Set(["OPTED_IN", "OPTED_OUT", "PENDING"]).has(status)) throw new Error("El estado de consentimiento no es válido.");
  const now = new Date();
  await prisma.communicationConsent.upsert({
    where: { churchId_personId_channel: { churchId: user.churchId, personId: person.id, channel: "WHATSAPP" } },
    create: { churchId: user.churchId, personId: person.id, channel: "WHATSAPP", normalizedRecipient: person.normalizedPhone, status: status as "OPTED_IN" | "OPTED_OUT" | "PENDING", source: text(formData, "source", true), evidence: text(formData, "evidence") || null, optedInAt: status === "OPTED_IN" ? now : null, optedOutAt: status === "OPTED_OUT" ? now : null },
    update: { normalizedRecipient: person.normalizedPhone, status: status as "OPTED_IN" | "OPTED_OUT" | "PENDING", source: text(formData, "source", true), evidence: text(formData, "evidence") || null, optedInAt: status === "OPTED_IN" ? now : undefined, optedOutAt: status === "OPTED_OUT" ? now : null },
  });
  refresh();
}

export async function createAudienceAction(formData: FormData) {
  const user = await requirePermission("communications.create");
  const type = text(formData, "type", true);
  if (!new Set(["ALL_ACTIVE", "MEMBERS", "VISITORS", "TAG", "SERVICE_ATTENDEES"]).has(type)) throw new Error("El tipo de audiencia no es válido.");
  const criteria: Record<string, string> = { type };
  if (type === "TAG") { const tag = text(formData, "tag"); if (!tag) throw new Error("Indica la etiqueta de la audiencia."); criteria.tag = tag; }
  if (type === "SERVICE_ATTENDEES") { const servicePlanId = text(formData, "servicePlanId"); if (!servicePlanId || !await prisma.servicePlan.count({ where: { id: servicePlanId, churchId: user.churchId } })) throw new Error("Selecciona un servicio válido."); criteria.servicePlanId = servicePlanId; }
  await prisma.communicationAudience.create({ data: { churchId: user.churchId, name: text(formData, "name", true), description: text(formData, "description") || null, criteria } });
  refresh();
}

export async function createCommunicationTemplateAction(formData: FormData) {
  const user = await requirePermission("communications.create");
  const chosen = selectedChannels(formData);
  if (!chosen.length) throw new Error("Selecciona al menos un canal.");
  const content = Object.fromEntries(chosen.map((channel) => [channel, text(formData, channel, true)]));
  await prisma.communicationTemplate.create({ data: {
    churchId: user.churchId, name: text(formData, "name", true), channels: databaseList(chosen),
    language: text(formData, "language") || "es_MX", category: (text(formData, "category") || "MARKETING") as "MARKETING" | "UTILITY" | "AUTHENTICATION",
    approvalMode: formData.get("approvalMode") === "AUTOMATIC" ? "AUTOMATIC" : "REQUIRED", content,
    remoteTemplateName: text(formData, "remoteTemplateName") || null,
  } });
  refresh();
}

export async function submitWhatsAppTemplateAction(formData: FormData) {
  const user = await requirePermission("communications.connections.manage");
  const template = await prisma.communicationTemplate.findFirst({ where: { id: text(formData, "templateId", true), churchId: user.churchId } });
  const connection = await prisma.socialConnection.findFirst({ where: { churchId: user.churchId, provider: "WHATSAPP", status: "CONNECTED" } });
  if (!template || !connection) throw new Error("Falta la plantilla o la conexión activa de WhatsApp.");
  const body = String((template.content as Record<string, unknown>).WHATSAPP ?? "");
  if (!body) throw new Error("La plantilla no contiene texto para WhatsApp.");
  const remoteName = template.remoteTemplateName ?? template.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 64);
  const result = await submitWhatsAppTemplate(connection, { name: remoteName, language: template.language, category: template.category, body: metaTemplateBody(body) });
  await prisma.communicationTemplate.update({ where: { id: template.id }, data: { status: "SUBMITTED", remoteTemplateName: remoteName, remoteTemplateId: String(result.id ?? "") || null, lastSyncedAt: new Date(), rejectionReason: null } });
  refresh();
}

export async function syncWhatsAppTemplateAction(formData: FormData) {
  const user = await requirePermission("communications.connections.manage");
  const template = await prisma.communicationTemplate.findFirst({ where: { id: text(formData, "templateId", true), churchId: user.churchId } });
  const connection = await prisma.socialConnection.findFirst({ where: { churchId: user.churchId, provider: "WHATSAPP", status: "CONNECTED" } });
  if (!template?.remoteTemplateName || !connection) throw new Error("La plantilla aún no fue enviada a Meta.");
  const result = await listWhatsAppTemplates(connection, template.remoteTemplateName) as { data?: Array<{ id?: string; status?: string; rejected_reason?: string }> };
  const remote = result.data?.[0];
  if (!remote) throw new Error("Meta no devolvió la plantilla solicitada.");
  const status = String(remote.status ?? "SUBMITTED");
  await prisma.communicationTemplate.update({ where: { id: template.id }, data: { status: templateStatuses.has(status as CommunicationTemplateStatus) ? status as CommunicationTemplateStatus : "SUBMITTED", remoteTemplateId: remote.id ?? template.remoteTemplateId, rejectionReason: remote.rejected_reason ?? null, lastSyncedAt: new Date() } });
  refresh();
}

export async function createCampaignAction(formData: FormData) {
  const user = await requirePermission("communications.create");
  const metadata = await loadYoutubeMetadata(text(formData, "sourceUrl", true));
  const template = await prisma.communicationTemplate.findFirst({ where: { id: text(formData, "templateId", true), churchId: user.churchId } });
  if (!template) throw new Error("Selecciona una plantilla válida.");
  const servicePlanId = text(formData, "servicePlanId");
  if (servicePlanId && !await prisma.servicePlan.count({ where: { id: servicePlanId, churchId: user.churchId } })) throw new Error("El servicio seleccionado no existe.");
  const campaign = await prisma.communicationCampaign.create({ data: {
    churchId: user.churchId, createdByUserId: user.id, servicePlanId: servicePlanId || null,
    templateId: template.id, audienceId: text(formData, "audienceId") || null,
    title: text(formData, "title") || metadata.title, sourceUrl: metadata.url, youtubeVideoId: metadata.id,
    youtubeTitle: metadata.title, youtubeDescription: metadata.description, youtubeChannel: metadata.channel,
    youtubeThumbnailUrl: metadata.thumbnailUrl, content: template.content as Prisma.InputJsonValue, approvalMode: template.approvalMode,
  } });
  await prisma.communicationAuditEvent.create({ data: { churchId: user.churchId, campaignId: campaign.id, actorUserId: user.id, eventType: "CAMPAIGN_CREATED" } });
  refresh();
  return { status: "success", message: "La campaña se creó como borrador.", href: `/communications?view=campaigns&campaignId=${campaign.id}`, hrefLabel: "Abrir campaña" };
}

export async function updateCampaignContentAction(formData: FormData) {
  const user = await requirePermission("communications.create");
  const campaign = await prisma.communicationCampaign.findFirst({ where: { id: text(formData, "campaignId", true), churchId: user.churchId }, include: { template: true } });
  if (!campaign || !campaign.template || campaign.status === "COMPLETE") throw new Error("La campaña ya no puede editarse.");
  const content = Object.fromEntries(stringList(campaign.template.channels).map((channel) => [channel, text(formData, channel, true)]));
  const updated = await prisma.communicationCampaign.update({ where: { id: campaign.id }, data: { title: text(formData, "title", true), audienceId: text(formData, "audienceId") || null, content, contentVersion: { increment: 1 }, approvedVersion: null, status: "DRAFT" } });
  await prisma.communicationAuditEvent.create({ data: { churchId: user.churchId, campaignId: campaign.id, actorUserId: user.id, eventType: "CAMPAIGN_UPDATED", metadata: { contentVersion: updated.contentVersion } } });
  refresh();
}

async function campaignSchedule(formData: FormData, churchId: string) {
  const church = await prisma.church.findUniqueOrThrow({ where: { id: churchId }, select: { timeZone: true } });
  const mode = text(formData, "scheduleMode") || "EXACT";
  if (mode === "RELATIVE") {
    const service = await prisma.servicePlan.findFirst({ where: { id: text(formData, "servicePlanId", true), churchId }, select: { serviceAt: true } });
    if (!service) throw new Error("Selecciona un servicio para el horario relativo.");
    const offset = Number(text(formData, "relativeDayOffset") || "0");
    if (!Number.isInteger(offset) || offset < -30 || offset > 30) throw new Error("El desplazamiento debe estar entre -30 y 30 días.");
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: church.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(service.serviceAt);
    const base = new Date(`${localDate}T12:00:00Z`); base.setUTCDate(base.getUTCDate() + offset);
    return { scheduledAt: localDateTime(base.toISOString().slice(0, 10), text(formData, "relativeLocalTime", true), church.timeZone), relativeDayOffset: offset, relativeLocalTime: text(formData, "relativeLocalTime", true) };
  }
  return { scheduledAt: localDateTime(text(formData, "scheduledDate", true), text(formData, "scheduledTime", true), church.timeZone), relativeDayOffset: null, relativeLocalTime: null };
}

export async function scheduleCampaignAction(formData: FormData) {
  const user = await requirePermission("communications.publish");
  const campaign = await prisma.communicationCampaign.findFirst({ where: { id: text(formData, "campaignId", true), churchId: user.churchId }, include: { template: true } });
  if (!campaign?.template || !["DRAFT", "WAITING_APPROVAL", "FAILED"].includes(campaign.status)) throw new Error("La campaña no puede programarse en su estado actual.");
  const schedule = await campaignSchedule(formData, user.churchId);
  if (schedule.scheduledAt <= new Date()) throw new Error("Selecciona una fecha y hora futura.");
  const needsApproval = campaign.approvalMode === "REQUIRED" && campaign.approvedVersion !== campaign.contentVersion;
  await prisma.communicationCampaign.update({ where: { id: campaign.id }, data: { ...schedule, status: needsApproval ? "WAITING_APPROVAL" : "SCHEDULED" } });
  if (!needsApproval) await materializeCampaignDeliveries(campaign.id, user.churchId);
  await prisma.communicationAuditEvent.create({ data: { churchId: user.churchId, campaignId: campaign.id, actorUserId: user.id, eventType: needsApproval ? "APPROVAL_REQUESTED" : "CAMPAIGN_SCHEDULED", metadata: { scheduledAt: schedule.scheduledAt.toISOString() } } });
  refresh();
}

export async function approveCampaignAction(formData: FormData) {
  const user = await requirePermission("communications.approve");
  const campaign = await prisma.communicationCampaign.findFirst({ where: { id: text(formData, "campaignId", true), churchId: user.churchId } });
  if (!campaign?.scheduledAt || campaign.status !== "WAITING_APPROVAL") throw new Error("La campaña debe tener un horario antes de aprobarse.");
  await prisma.$transaction([
    prisma.campaignApproval.upsert({ where: { campaignId_contentVersion: { campaignId: campaign.id, contentVersion: campaign.contentVersion } }, create: { campaignId: campaign.id, approvedById: user.id, contentVersion: campaign.contentVersion }, update: { approvedById: user.id } }),
    prisma.communicationCampaign.update({ where: { id: campaign.id }, data: { approvedVersion: campaign.contentVersion, status: "SCHEDULED" } }),
    prisma.communicationAuditEvent.create({ data: { churchId: user.churchId, campaignId: campaign.id, actorUserId: user.id, eventType: "CAMPAIGN_APPROVED", metadata: { contentVersion: campaign.contentVersion } } }),
  ]);
  try { await materializeCampaignDeliveries(campaign.id, user.churchId); } catch (error) {
    await prisma.communicationCampaign.update({ where: { id: campaign.id }, data: { status: "FAILED" } });
    throw error;
  }
  refresh();
}

export async function cancelCampaignAction(formData: FormData) {
  const user = await requirePermission("communications.publish");
  const campaignId = text(formData, "campaignId", true);
  const campaign = await prisma.communicationCampaign.findFirst({ where: { id: campaignId, churchId: user.churchId } });
  if (!campaign || ["COMPLETE", "CANCELLED"].includes(campaign.status)) throw new Error("La campaña no puede cancelarse.");
  await prisma.$transaction([
    prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "CANCELLED" } }),
    prisma.campaignDelivery.updateMany({ where: { campaignId, churchId: user.churchId, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED" } }),
    prisma.communicationAuditEvent.create({ data: { churchId: user.churchId, campaignId, actorUserId: user.id, eventType: "CAMPAIGN_CANCELLED" } }),
  ]);
  refresh();
}
