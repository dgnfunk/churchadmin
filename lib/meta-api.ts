import type { SocialConnection } from "@prisma/client";
import { decryptCredentials } from "@/lib/credential-crypto";

const graphVersion = process.env.META_GRAPH_API_VERSION ?? "v25.0";
const graphBase = `https://graph.facebook.com/${graphVersion}`;

type MetaError = { error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean } };

export class MetaApiError extends Error {
  constructor(message: string, public code?: number, public transient = false) { super(message); }
}

async function metaFetch(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${graphBase}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init?.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as MetaError & Record<string, unknown>;
  if (!response.ok) throw new MetaApiError(payload.error?.message ?? "Meta rechazó la solicitud.", payload.error?.code, Boolean(payload.error?.is_transient) || response.status === 429 || response.status >= 500);
  return payload;
}

function token(connection: SocialConnection) {
  if (!connection.encryptedCredentials) throw new Error("La conexión no tiene credenciales configuradas.");
  const credentials = decryptCredentials(connection.encryptedCredentials);
  if (!credentials.accessToken) throw new Error("La conexión no contiene un access token.");
  return credentials.accessToken;
}

export async function verifyMetaConnection(connection: SocialConnection) {
  const accessToken = token(connection);
  const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
  const target = connection.provider === "WHATSAPP" ? String(metadata.phoneNumberId ?? "") : connection.externalAccountId;
  if (!target) throw new Error("Falta el Phone Number ID de WhatsApp.");
  const fields = connection.provider === "WHATSAPP" ? "id,display_phone_number,verified_name,quality_rating" : connection.provider === "INSTAGRAM" ? "id,username,name" : "id,name";
  return metaFetch(`${encodeURIComponent(target)}?fields=${encodeURIComponent(fields)}`, accessToken);
}

export async function submitWhatsAppTemplate(connection: SocialConnection, input: { name: string; language: string; category: string; body: string }) {
  return metaFetch(`${encodeURIComponent(connection.externalAccountId)}/message_templates`, token(connection), {
    method: "POST",
    body: JSON.stringify({ name: input.name, language: input.language, category: input.category, components: [{ type: "BODY", text: input.body }] }),
  });
}

export async function listWhatsAppTemplates(connection: SocialConnection, name?: string) {
  const query = new URLSearchParams({ fields: "id,name,status,category,language,rejected_reason" });
  if (name) query.set("name", name);
  return metaFetch(`${encodeURIComponent(connection.externalAccountId)}/message_templates?${query}`, token(connection));
}

export async function sendWhatsAppTemplate(connection: SocialConnection, input: { to: string; templateName: string; language: string; parameters: string[] }) {
  const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
  const phoneNumberId = String(metadata.phoneNumberId ?? "");
  if (!phoneNumberId) throw new Error("Falta el Phone Number ID de WhatsApp.");
  const components = input.parameters.length ? [{ type: "body", parameters: input.parameters.map((text) => ({ type: "text", text })) }] : undefined;
  return metaFetch(`${encodeURIComponent(phoneNumberId)}/messages`, token(connection), {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: input.to, type: "template", template: { name: input.templateName, language: { code: input.language }, ...(components ? { components } : {}) } }),
  });
}

export async function publishFacebook(connection: SocialConnection, input: { message: string; link: string }) {
  return metaFetch(`${encodeURIComponent(connection.externalAccountId)}/feed`, token(connection), { method: "POST", body: JSON.stringify(input) });
}

export async function publishInstagram(connection: SocialConnection, input: { caption: string; imageUrl: string }) {
  const created = await metaFetch(`${encodeURIComponent(connection.externalAccountId)}/media`, token(connection), { method: "POST", body: JSON.stringify({ image_url: input.imageUrl, caption: input.caption }) });
  const creationId = String(created.id ?? "");
  if (!creationId) throw new Error("Instagram no devolvió el identificador del contenido.");
  return metaFetch(`${encodeURIComponent(connection.externalAccountId)}/media_publish`, token(connection), { method: "POST", body: JSON.stringify({ creation_id: creationId }) });
}
