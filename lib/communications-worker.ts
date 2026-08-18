import type { CampaignDelivery, Prisma } from "@prisma/client";
import { MetaApiError, publishFacebook, publishInstagram, sendWhatsAppTemplate } from "@/lib/meta-api";
import { prisma } from "@/lib/prisma";
import { databaseProvider } from "@/lib/database-compat";
import { sendOperationalEmail } from "@/lib/email";

type JsonMap = Record<string, unknown>;
const map = (value: Prisma.JsonValue) => (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as JsonMap;

async function notifyAdmins(churchId: string, title: string, body: string, campaignId: string) {
  const admins = await prisma.user.findMany({ where: { churchId, role: "ADMIN", isActive: true }, select: { id: true, email: true } });
  if (admins.length) await prisma.notification.createMany({ data: admins.map((user) => ({ churchId, userId: user.id, title, body, href: `/communications?view=campaigns&campaignId=${campaignId}` })) });
  await sendOperationalEmail({ to: admins.map((admin) => admin.email), subject: `[ChurchAdmin] ${title}`, text: `${body}\n\nRevisa la campaña: ${(process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/communications?view=campaigns&campaignId=${campaignId}` }).catch((error) => console.error(JSON.stringify({ level: "error", event: "communications_email_failed", message: error instanceof Error ? error.message : String(error) })));
}

async function updateCampaign(campaignId: string) {
  const deliveries = await prisma.campaignDelivery.findMany({ where: { campaignId }, select: { status: true } });
  if (!deliveries.length) return;
  const statuses = new Set(deliveries.map((delivery) => delivery.status));
  const active = statuses.has("PENDING") || statuses.has("PROCESSING");
  const succeeded = deliveries.some((delivery) => ["SENT", "DELIVERED", "READ"].includes(delivery.status));
  const failed = statuses.has("FAILED") || statuses.has("SKIPPED");
  const status = active ? "PROCESSING" : succeeded && failed ? "PARTIAL" : failed ? "FAILED" : "COMPLETE";
  await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status } });
}

async function deliver(delivery: CampaignDelivery & { connection: NonNullable<CampaignDelivery["connectionId"]> extends never ? never : object }) {
  const content = map(delivery.content);
  const connection = delivery.connection as Awaited<ReturnType<typeof prisma.socialConnection.findUniqueOrThrow>>;
  if (delivery.channel === "WHATSAPP") {
    if (delivery.personId) {
      const consent = await prisma.communicationConsent.findFirst({ where: { churchId: delivery.churchId, personId: delivery.personId, channel: "WHATSAPP", status: "OPTED_IN", normalizedRecipient: delivery.recipientKey } });
      if (!consent) return { skipped: true, reason: "El consentimiento fue retirado antes del envío." };
    }
    const result = await sendWhatsAppTemplate(connection, { to: delivery.recipientKey, templateName: String(content.templateName), language: String(content.language), parameters: Array.isArray(content.parameters) ? content.parameters.map(String) : [] });
    const messages = result.messages as Array<{ id?: string }> | undefined;
    return { externalId: messages?.[0]?.id };
  }
  if (delivery.channel === "FACEBOOK") {
    const result = await publishFacebook(connection, { message: String(content.message ?? ""), link: String(content.link ?? "") });
    return { externalId: String(result.id ?? "") || undefined };
  }
  if (!content.imageUrl) throw new Error("El video no tiene una miniatura pública para Instagram.");
  const result = await publishInstagram(connection, { caption: String(content.caption ?? ""), imageUrl: String(content.imageUrl) });
  return { externalId: String(result.id ?? "") || undefined };
}

export async function processNextCommunicationDelivery() {
  const claimedId = await prisma.$transaction(async (tx) => {
    const rows = databaseProvider === "mysql"
      ? await tx.$queryRawUnsafe<Array<{ id: string }>>("SELECT `id` FROM `CampaignDelivery` WHERE `status` = 'PENDING' AND `scheduledAt` <= NOW() ORDER BY `scheduledAt` ASC LIMIT 1 FOR UPDATE SKIP LOCKED")
      : await tx.$queryRawUnsafe<Array<{ id: string }>>("SELECT \"id\" FROM \"CampaignDelivery\" WHERE \"status\" = 'PENDING' AND \"scheduledAt\" <= now() ORDER BY \"scheduledAt\" ASC LIMIT 1 FOR UPDATE SKIP LOCKED");
    if (!rows[0]) return null;
    await tx.campaignDelivery.update({ where: { id: rows[0].id }, data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } } });
    return rows[0].id;
  });
  if (!claimedId) return false;
  const delivery = await prisma.campaignDelivery.findUniqueOrThrow({ where: { id: claimedId }, include: { connection: true } });
  await prisma.communicationCampaign.update({ where: { id: delivery.campaignId }, data: { status: "PROCESSING" } });
  try {
    if (!delivery.connection || delivery.connection.status !== "CONNECTED") throw new Error("La conexión dejó de estar disponible.");
    const result = await deliver(delivery as typeof delivery & { connection: object });
    await prisma.campaignDelivery.update({ where: { id: delivery.id }, data: result.skipped
      ? { status: "SKIPPED", failedAt: new Date(), lockedAt: null, errorMessage: result.reason }
      : { status: "SENT", sentAt: new Date(), lockedAt: null, externalMessageId: result.externalId ?? null, errorCode: null, errorMessage: null } });
  } catch (error) {
    const transient = error instanceof MetaApiError && error.transient;
    if (transient && delivery.attempts < 3) {
      await prisma.campaignDelivery.update({ where: { id: delivery.id }, data: { status: "PENDING", scheduledAt: new Date(Date.now() + Math.pow(2, delivery.attempts) * 60_000), lockedAt: null, errorCode: error.code ? String(error.code) : null, errorMessage: error.message } });
    } else {
      const message = error instanceof Error ? error.message : "La entrega falló.";
      await prisma.campaignDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", failedAt: new Date(), lockedAt: null, errorCode: error instanceof MetaApiError && error.code ? String(error.code) : "DELIVERY_ERROR", errorMessage: message } });
      await notifyAdmins(delivery.churchId, "Falló una publicación", message, delivery.campaignId);
    }
  }
  await updateCampaign(delivery.campaignId);
  return true;
}
