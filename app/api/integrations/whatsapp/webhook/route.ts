import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.get("hub.mode") !== "subscribe" || query.get("hub.verify_token") !== process.env.META_WEBHOOK_VERIFY_TOKEN) return new Response("Forbidden", { status: 403 });
  return new Response(query.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}

function validSignature(body: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const received = Buffer.from(signature.slice(7));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type WhatsAppWebhook = {
  entry?: Array<{ id?: string; changes?: Array<{ value?: {
    metadata?: { phone_number_id?: string };
    statuses?: Array<{ id?: string; status?: string; timestamp?: string; errors?: Array<{ code?: number; title?: string }> }>;
    messages?: Array<{ id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } }>;
  } }> }>;
};

async function connectionForPhone(phoneNumberId: string) {
  const connections = await prisma.socialConnection.findMany({ where: { provider: "WHATSAPP" }, select: { churchId: true, metadata: true } });
  return connections.find((connection) => String((connection.metadata as Record<string, unknown> | null)?.phoneNumberId ?? "") === phoneNumberId);
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  let payload: WhatsAppWebhook;
  try { payload = JSON.parse(body) as WhatsAppWebhook; } catch { return new Response("Invalid JSON", { status: 400 }); }
  const payloadHash = createHash("sha256").update(body).digest("hex");

  for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
    const value = change.value;
    const phoneNumberId = value?.metadata?.phone_number_id ?? "";
    const connection = phoneNumberId ? await connectionForPhone(phoneNumberId) : null;
    for (const status of value?.statuses ?? []) {
      if (!status.id || !status.status) continue;
      const externalId = `${status.id}:${status.status}:${status.timestamp ?? ""}`;
      const event = await prisma.webhookEvent.upsert({ where: { provider_externalId: { provider: "WHATSAPP", externalId } }, create: { churchId: connection?.churchId, provider: "WHATSAPP", externalId, payloadHash }, update: {} });
      if (event.processedAt) continue;
      const mapped = status.status === "delivered" ? "DELIVERED" : status.status === "read" ? "READ" : status.status === "failed" ? "FAILED" : "SENT";
      const at = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
      await prisma.$transaction([
        prisma.campaignDelivery.updateMany({ where: { externalMessageId: status.id, ...(connection ? { churchId: connection.churchId } : {}) }, data: {
          status: mapped, ...(mapped === "DELIVERED" ? { deliveredAt: at } : {}), ...(mapped === "READ" ? { readAt: at } : {}),
          ...(mapped === "FAILED" ? { failedAt: at, errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : "META_FAILED", errorMessage: status.errors?.[0]?.title ?? "Meta informó que el mensaje falló." } : {}),
        } }),
        prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } }),
      ]);
    }
    for (const message of value?.messages ?? []) {
      if (!message.id) continue;
      const event = await prisma.webhookEvent.upsert({ where: { provider_externalId: { provider: "WHATSAPP", externalId: message.id } }, create: { churchId: connection?.churchId, provider: "WHATSAPP", externalId: message.id, payloadHash }, update: {} });
      if (event.processedAt) continue;
      const normalized = (message.from ?? "").replace(/\D/g, "");
      const command = message.text?.body?.trim().toUpperCase();
      if (connection && normalized && ["BAJA", "STOP", "CANCELAR"].includes(command ?? "")) {
        await prisma.communicationConsent.updateMany({ where: { churchId: connection.churchId, channel: "WHATSAPP", normalizedRecipient: normalized }, data: { status: "OPTED_OUT", optedOutAt: new Date(), source: "Respuesta al número oficial" } });
      }
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    }
  }
  return new Response("EVENT_RECEIVED", { status: 200, headers: { "cache-control": "no-store" } });
}
