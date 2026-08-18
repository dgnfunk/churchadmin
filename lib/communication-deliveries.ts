import type { CommunicationCampaign, CommunicationTemplate, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderCommunicationTemplate, templateVariableValues, type TemplateContext } from "@/lib/communication-content";
import { containsListValue, stringList } from "@/lib/database-compat";

type JsonMap = Record<string, unknown>;

function map(value: Prisma.JsonValue | null | undefined) { return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as JsonMap; }

async function audiencePeople(churchId: string, audienceId: string | null, servicePlanId: string | null) {
  const audience = audienceId ? await prisma.communicationAudience.findFirst({ where: { id: audienceId, churchId, isActive: true } }) : null;
  const criteria = map(audience?.criteria);
  const type = String(criteria.type ?? "ALL_ACTIVE");
  const where: Prisma.PersonWhereInput = { churchId, status: "ACTIVE" };
  if (type === "MEMBERS") where.personType = "MEMBER";
  if (type === "VISITORS") where.personType = "VISITOR";
  if (type === "TAG" && criteria.tag) where.tags = containsListValue(String(criteria.tag));
  if (type === "MANUAL" && Array.isArray(criteria.personIds)) where.id = { in: criteria.personIds.map(String) };
  if (type === "SERVICE_ATTENDEES") {
    const selectedServiceId = String(criteria.servicePlanId ?? servicePlanId ?? "");
    where.attendance = { some: { session: { servicePlanId: selectedServiceId } } };
  }
  return prisma.person.findMany({
    where,
    include: { communicationConsents: { where: { channel: "WHATSAPP", status: "OPTED_IN" } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

function context(campaign: CommunicationCampaign & { church: { name: string; timeZone: string }; servicePlan: { title: string; serviceAt: Date } | null }, person?: { firstName: string }): TemplateContext {
  return {
    person,
    church: campaign.church,
    service: campaign.servicePlan ? { title: campaign.servicePlan.title, date: new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: campaign.church.timeZone }).format(campaign.servicePlan.serviceAt) } : undefined,
    youtube: { title: campaign.youtubeTitle, channel: campaign.youtubeChannel ?? "", url: campaign.sourceUrl },
  };
}

export async function materializeCampaignDeliveries(campaignId: string, churchId: string) {
  const campaign = await prisma.communicationCampaign.findFirstOrThrow({
    where: { id: campaignId, churchId },
    include: { church: { select: { name: true, timeZone: true } }, servicePlan: { select: { title: true, serviceAt: true } }, template: true },
  });
  if (!campaign.scheduledAt || !campaign.template) throw new Error("La campaña no tiene plantilla u horario.");
  const content = map(campaign.content);
  const templateContent = map(campaign.template.content);
  const templateChannels = stringList(campaign.template.channels) as Array<"WHATSAPP" | "FACEBOOK" | "INSTAGRAM">;
  const connections = await prisma.socialConnection.findMany({ where: { churchId, status: "CONNECTED", provider: { in: templateChannels } } });
  const people = await audiencePeople(churchId, campaign.audienceId, campaign.servicePlanId);
  const rows: Prisma.CampaignDeliveryCreateManyInput[] = [];

  if (templateChannels.includes("WHATSAPP")) {
    if (campaign.template.status !== "APPROVED" || !campaign.template.remoteTemplateName) throw new Error("La plantilla de WhatsApp debe estar aprobada y sincronizada con Meta.");
    const connection = connections.find((item) => item.provider === "WHATSAPP");
    if (!connection) throw new Error("Conecta y verifica WhatsApp antes de programar la campaña.");
    const body = String(content.WHATSAPP ?? templateContent.WHATSAPP ?? "");
    const seen = new Set<string>();
    for (const person of people) {
      const consent = person.communicationConsents[0];
      if (!consent || seen.has(consent.normalizedRecipient)) continue;
      seen.add(consent.normalizedRecipient);
      const personContext = context(campaign, person);
      rows.push({
        churchId, campaignId, channel: "WHATSAPP", connectionId: connection.id, personId: person.id,
        recipientKey: consent.normalizedRecipient, recipientName: `${person.firstName} ${person.lastName}`,
        scheduledAt: campaign.scheduledAt,
        content: { renderedText: renderCommunicationTemplate(body, personContext), templateName: campaign.template.remoteTemplateName, language: campaign.template.language, parameters: templateVariableValues(body, personContext) },
      });
    }
  }

  for (const channel of ["FACEBOOK", "INSTAGRAM"] as const) {
    if (!templateChannels.includes(channel)) continue;
    const connection = connections.find((item) => item.provider === channel);
    if (!connection) throw new Error(`Conecta y verifica ${channel === "FACEBOOK" ? "Facebook" : "Instagram"} antes de programar.`);
    const body = String(content[channel] ?? templateContent[channel] ?? "");
    rows.push({
      churchId, campaignId, channel, connectionId: connection.id, recipientKey: connection.externalAccountId,
      recipientName: connection.displayName, scheduledAt: campaign.scheduledAt,
      content: channel === "FACEBOOK"
        ? { message: renderCommunicationTemplate(body, context(campaign)), link: campaign.sourceUrl }
        : { caption: renderCommunicationTemplate(body, context(campaign)), imageUrl: campaign.youtubeThumbnailUrl },
    });
  }

  if (!rows.length) throw new Error("La audiencia no contiene destinatarios con consentimiento o faltan conexiones activas.");
  await prisma.$transaction([
    prisma.campaignDelivery.deleteMany({ where: { campaignId, churchId, status: { in: ["PENDING", "FAILED", "SKIPPED", "CANCELLED"] } } }),
    prisma.campaignDelivery.createMany({ data: rows, skipDuplicates: true }),
  ]);
  return rows.length;
}
