import type { AttendanceTrendPeriod, AttendanceTrendPoint, AttendanceTrendSummary } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

interface LocalDateParts { year: number; month: number; day: number }

function localParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function parseAnchor(anchor: string | undefined, timeZone: string) {
  if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    const [year, month, day] = anchor.split("-").map(Number);
    return { year, month, day };
  }
  return localParts(new Date(), timeZone);
}

function shiftPeriod(anchor: LocalDateParts, period: AttendanceTrendPeriod, direction: number): LocalDateParts {
  const amount = period === "month" ? 1 : period === "semester" ? 6 : 12;
  const date = new Date(Date.UTC(anchor.year, anchor.month - 1 + direction * amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 };
}

function iso(parts: LocalDateParts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function inPeriod(parts: LocalDateParts, anchor: LocalDateParts, period: AttendanceTrendPeriod) {
  if (period === "month") return parts.year === anchor.year && parts.month === anchor.month;
  if (period === "year") return parts.year === anchor.year;
  const startMonth = anchor.month <= 6 ? 1 : 7;
  return parts.year === anchor.year && parts.month >= startMonth && parts.month < startMonth + 6;
}

function monthName(year: number, month: number, timeZone: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "short", timeZone }).format(new Date(Date.UTC(year, month - 1, 15)));
}

function summarize(points: AttendanceTrendPoint[], previousTotal: number): AttendanceTrendSummary {
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const serviceCount = points.reduce((sum, point) => sum + point.serviceCount, 0);
  return {
    total,
    members: points.reduce((sum, point) => sum + point.members, 0),
    visitors: points.reduce((sum, point) => sum + point.visitors, 0),
    serviceCount,
    averagePerService: serviceCount ? Math.round((total / serviceCount) * 10) / 10 : 0,
    peak: points.reduce((max, point) => Math.max(max, point.total), 0),
    changePercent: previousTotal ? Math.round(((total - previousTotal) / previousTotal) * 1000) / 10 : undefined
  };
}

function buildPoints(sessions: Awaited<ReturnType<typeof loadSessions>>, anchor: LocalDateParts, period: AttendanceTrendPeriod, timeZone: string) {
  const selected = sessions.filter((session) => inPeriod(localParts(session.serviceAt, timeZone), anchor, period));
  if (period === "month") return selected.map((session) => {
    const parts = localParts(session.serviceAt, timeZone);
    const members = session.records.filter((record) => record.person.personType === "MEMBER").length;
    const visitors = session.records.length - members;
    return { key: session.id, label: `${monthName(parts.year, parts.month, timeZone)} ${parts.day}`, serviceCount: 1, total: session.records.length, members, visitors };
  });
  const startMonth = period === "semester" ? (anchor.month <= 6 ? 1 : 7) : 1;
  const count = period === "semester" ? 6 : 12;
  return Array.from({ length: count }, (_, index): AttendanceTrendPoint => {
    const month = startMonth + index;
    const monthly = selected.filter((session) => localParts(session.serviceAt, timeZone).month === month);
    const records = monthly.flatMap((session) => session.records);
    const members = records.filter((record) => record.person.personType === "MEMBER").length;
    return { key: `${anchor.year}-${month}`, label: monthName(anchor.year, month, timeZone), serviceCount: monthly.length, total: records.length, members, visitors: records.length - members };
  });
}

async function loadSessions(churchId: string) {
  return prisma.attendanceSession.findMany({
    where: { churchId, serviceAt: { lte: new Date() } }, orderBy: { serviceAt: "asc" },
    include: { records: { include: { person: { select: { personType: true } } } } }
  });
}

export async function getAttendanceReport(churchId: string, period: AttendanceTrendPeriod, anchorValue?: string) {
  const church = await prisma.church.findUniqueOrThrow({ where: { id: churchId }, select: { timeZone: true } });
  const anchor = parseAnchor(anchorValue, church.timeZone);
  const previousAnchor = shiftPeriod(anchor, period, -1);
  const nextAnchor = shiftPeriod(anchor, period, 1);
  const sessions = await loadSessions(churchId);
  const points = buildPoints(sessions, anchor, period, church.timeZone);
  const previousPoints = buildPoints(sessions, previousAnchor, period, church.timeZone);
  const previousTotal = previousPoints.reduce((sum, point) => sum + point.total, 0);
  return { period, anchor: iso(anchor), previousAnchor: iso(previousAnchor), nextAnchor: iso(nextAnchor), points, summary: summarize(points, previousTotal), timeZone: church.timeZone };
}

export async function getAttendanceHistory(churchId: string) {
  const sessions = await prisma.attendanceSession.findMany({
    where: { churchId }, orderBy: { serviceAt: "desc" },
    include: { records: { include: { person: { select: { personType: true } } } } }, take: 100
  });
  return sessions.map((session) => ({
    id: session.id, qrToken: session.qrToken, title: session.title, serviceAt: session.serviceAt.toISOString(), status: session.status,
    total: session.records.length,
    members: session.records.filter((record) => record.person.personType === "MEMBER").length,
    visitors: session.records.filter((record) => record.person.personType === "VISITOR").length,
    qr: session.records.filter((record) => record.source === "QR").length,
    manual: session.records.filter((record) => record.source === "MANUAL").length
  }));
}
