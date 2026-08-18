import "server-only";

import type { OfferingTrendPeriod } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { buildOfferingReport, offeringCurrentMonthBounds, parseOfferingAnchor, recordsInOfferingPeriod } from "@/lib/offering-reporting-core";

const closureInclude = {
  confirmedBy: { select: { name: true } },
  auditEvents: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" as const } },
};

export async function getOfferingHistory(churchId: string, take = 200) {
  const services = await prisma.servicePlan.findMany({
    where: { churchId, status: "COMPLETED" },
    orderBy: { serviceAt: "desc" },
    take,
    include: { offeringClosure: { include: closureInclude } },
  });
  return services.map((service) => ({
    id: service.id,
    title: service.title,
    serviceAt: service.serviceAt.toISOString(),
    offering: service.offeringClosure ? {
      id: service.offeringClosure.id,
      amountMinor: service.offeringClosure.amountMinor.toString(),
      currencyCode: service.offeringClosure.currencyCode,
      note: service.offeringClosure.note,
      confirmedBy: service.offeringClosure.confirmedBy.name,
      confirmedAt: service.offeringClosure.confirmedAt.toISOString(),
      updatedAt: service.offeringClosure.updatedAt.toISOString(),
      auditEvents: service.offeringClosure.auditEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        previousAmountMinor: event.previousAmountMinor?.toString(),
        newAmountMinor: event.newAmountMinor.toString(),
        reason: event.reason,
        actorName: event.actor.name,
        createdAt: event.createdAt.toISOString(),
      })),
    } : undefined,
  }));
}

export async function getOfferingCaptureData(churchId: string, userId: string, timeZone: string, now = new Date()) {
  const bounds = offeringCurrentMonthBounds(now, timeZone);
  const [pending, ownClosures] = await Promise.all([
    prisma.servicePlan.findMany({
      where: { churchId, status: "COMPLETED", offeringClosure: null },
      orderBy: { serviceAt: "desc" },
      take: 200,
      select: { id: true, title: true, serviceAt: true },
    }),
    prisma.offeringClosure.findMany({
      where: { churchId, confirmedById: userId, confirmedAt: { gte: bounds.start, lt: bounds.end } },
      orderBy: { confirmedAt: "desc" },
      include: { servicePlan: { select: { title: true, serviceAt: true } } },
    }),
  ]);
  return {
    pending: pending.map((service) => ({ id: service.id, title: service.title, serviceAt: service.serviceAt.toISOString() })),
    ownClosures: ownClosures.map((offering) => ({
      id: offering.id,
      servicePlanId: offering.servicePlanId,
      title: offering.servicePlan.title,
      serviceAt: offering.servicePlan.serviceAt.toISOString(),
      amountMinor: offering.amountMinor.toString(),
      currencyCode: offering.currencyCode,
      note: offering.note,
      confirmedAt: offering.confirmedAt.toISOString(),
    })),
  };
}

async function loadOfferingReportSource(churchId: string) {
  const [church, services] = await Promise.all([
    prisma.church.findUniqueOrThrow({ where: { id: churchId }, select: { timeZone: true, currencyCode: true } }),
    prisma.servicePlan.findMany({
      where: { churchId, status: "COMPLETED" },
      orderBy: { serviceAt: "asc" },
      include: { offeringClosure: { include: { confirmedBy: { select: { name: true } }, auditEvents: { where: { eventType: "CORRECTED" }, orderBy: { createdAt: "desc" }, take: 1 } } } },
    }),
  ]);
  return { church, services };
}

export async function getOfferingReport(churchId: string, period: OfferingTrendPeriod, anchorValue?: string) {
  const { church, services } = await loadOfferingReportSource(churchId);
  const records = services.map((service) => ({ id: service.id, title: service.title, serviceAt: service.serviceAt, amountMinor: service.offeringClosure?.amountMinor }));
  return { ...buildOfferingReport(records, period, anchorValue, church.timeZone), timeZone: church.timeZone, currencyCode: church.currencyCode };
}

export async function getOfferingExportRows(churchId: string, period: OfferingTrendPeriod, anchorValue?: string) {
  const { church, services } = await loadOfferingReportSource(churchId);
  const anchor = parseOfferingAnchor(anchorValue, church.timeZone);
  const selectedIds = new Set(recordsInOfferingPeriod(services.map((service) => ({ id: service.id, title: service.title, serviceAt: service.serviceAt, amountMinor: service.offeringClosure?.amountMinor })), anchor, period, church.timeZone).map((record) => record.id));
  return {
    anchor,
    timeZone: church.timeZone,
    currencyCode: church.currencyCode,
    rows: services.filter((service) => selectedIds.has(service.id)).map((service) => ({
      servicePlanId: service.id,
      title: service.title,
      serviceAt: service.serviceAt,
      amountMinor: service.offeringClosure?.amountMinor,
      currencyCode: service.offeringClosure?.currencyCode ?? church.currencyCode,
      confirmedBy: service.offeringClosure?.confirmedBy.name,
      confirmedAt: service.offeringClosure?.confirmedAt,
      correctedAt: service.offeringClosure?.auditEvents[0]?.createdAt,
    })),
  };
}
