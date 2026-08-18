import type { OfferingTrendPeriod, OfferingTrendPoint, OfferingTrendSummary } from "@/lib/domain";
import { roundedAverageMinor } from "@/lib/offering-money";

export interface OfferingReportRecord {
  id: string;
  title: string;
  serviceAt: Date;
  amountMinor?: bigint;
}

interface LocalDateParts { year: number; month: number; day: number }

export function offeringLocalParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function zonedMidnight(year: number, month: number, day: number, timeZone: string) {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const representedUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
  return new Date(guess.getTime() - (representedUtc - guess.getTime()));
}

export function offeringCurrentMonthBounds(reference: Date, timeZone: string) {
  const current = offeringLocalParts(reference, timeZone);
  const next = new Date(Date.UTC(current.year, current.month, 1));
  return {
    start: zonedMidnight(current.year, current.month, 1, timeZone),
    end: zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, timeZone),
  };
}

export function capturerCanViewOffering(confirmedById: string, confirmedAt: Date, userId: string, reference: Date, timeZone: string) {
  if (confirmedById !== userId) return false;
  const captured = offeringLocalParts(confirmedAt, timeZone);
  const current = offeringLocalParts(reference, timeZone);
  return captured.year === current.year && captured.month === current.month;
}

export function parseOfferingAnchor(anchor: string | undefined, timeZone: string): LocalDateParts {
  if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    const [year, month, day] = anchor.split("-").map(Number);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day };
  }
  return offeringLocalParts(new Date(), timeZone);
}

function periodStart(anchor: LocalDateParts, period: OfferingTrendPeriod) {
  const month = period === "year" ? 1 : period === "semester" ? (anchor.month <= 6 ? 1 : 7) : period === "quarter" ? Math.floor((anchor.month - 1) / 3) * 3 + 1 : anchor.month;
  return { year: anchor.year, month, day: 1 };
}

function periodMonths(period: OfferingTrendPeriod) {
  return period === "month" ? 1 : period === "quarter" ? 3 : period === "semester" ? 6 : 12;
}

export function shiftOfferingPeriod(anchor: LocalDateParts, period: OfferingTrendPeriod, direction: number) {
  const start = periodStart(anchor, period);
  const date = new Date(Date.UTC(start.year, start.month - 1 + direction * periodMonths(period), 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 };
}

export function offeringIso(parts: LocalDateParts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function isInPeriod(parts: LocalDateParts, anchor: LocalDateParts, period: OfferingTrendPeriod) {
  const start = periodStart(anchor, period);
  const index = (parts.year - start.year) * 12 + parts.month - start.month;
  return index >= 0 && index < periodMonths(period);
}

export function recordsInOfferingPeriod(records: OfferingReportRecord[], anchor: LocalDateParts, period: OfferingTrendPeriod, timeZone: string) {
  return records.filter((record) => isInPeriod(offeringLocalParts(record.serviceAt, timeZone), anchor, period));
}

function monthName(year: number, month: number, timeZone: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "short", timeZone }).format(new Date(Date.UTC(year, month - 1, 15)));
}

export function buildOfferingPoints(records: OfferingReportRecord[], anchor: LocalDateParts, period: OfferingTrendPeriod, timeZone: string): OfferingTrendPoint[] {
  const selected = recordsInOfferingPeriod(records, anchor, period, timeZone);
  if (period === "month") return selected.map((record) => {
    const parts = offeringLocalParts(record.serviceAt, timeZone);
    const captured = record.amountMinor !== undefined;
    return { key: record.id, label: `${monthName(parts.year, parts.month, timeZone)} ${parts.day}`, serviceCount: 1, capturedCount: captured ? 1 : 0, pendingCount: captured ? 0 : 1, amountMinor: (record.amountMinor ?? 0n).toString() };
  });
  const start = periodStart(anchor, period);
  return Array.from({ length: periodMonths(period) }, (_, index) => {
    const date = new Date(Date.UTC(start.year, start.month - 1 + index, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const monthly = selected.filter((record) => { const parts = offeringLocalParts(record.serviceAt, timeZone); return parts.year === year && parts.month === month; });
    const captured = monthly.filter((record) => record.amountMinor !== undefined);
    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: monthName(year, month, timeZone),
      serviceCount: monthly.length,
      capturedCount: captured.length,
      pendingCount: monthly.length - captured.length,
      amountMinor: captured.reduce((sum, record) => sum + record.amountMinor!, 0n).toString(),
    };
  });
}

export function summarizeOfferingPoints(points: OfferingTrendPoint[], previousTotal: bigint): OfferingTrendSummary {
  const total = points.reduce((sum, point) => sum + BigInt(point.amountMinor), 0n);
  const capturedCount = points.reduce((sum, point) => sum + point.capturedCount, 0);
  return {
    totalAmountMinor: total.toString(),
    averageAmountMinor: roundedAverageMinor(total, capturedCount).toString(),
    peakAmountMinor: points.reduce((peak, point) => BigInt(point.amountMinor) > peak ? BigInt(point.amountMinor) : peak, 0n).toString(),
    capturedCount,
    pendingCount: points.reduce((sum, point) => sum + point.pendingCount, 0),
    changePercent: previousTotal > 0n ? Math.round((Number(total - previousTotal) / Number(previousTotal)) * 1000) / 10 : undefined,
  };
}

export function buildOfferingReport(records: OfferingReportRecord[], period: OfferingTrendPeriod, anchorValue: string | undefined, timeZone: string) {
  const anchor = parseOfferingAnchor(anchorValue, timeZone);
  const previousAnchor = shiftOfferingPeriod(anchor, period, -1);
  const nextAnchor = shiftOfferingPeriod(anchor, period, 1);
  const points = buildOfferingPoints(records, anchor, period, timeZone);
  const previousPoints = buildOfferingPoints(records, previousAnchor, period, timeZone);
  const previousTotal = previousPoints.reduce((sum, point) => sum + BigInt(point.amountMinor), 0n);
  const summary = summarizeOfferingPoints(points, previousTotal);
  const captured = recordsInOfferingPeriod(records, anchor, period, timeZone).filter((record) => record.amountMinor !== undefined);
  summary.peakAmountMinor = captured.reduce((peak, record) => record.amountMinor! > peak ? record.amountMinor! : peak, 0n).toString();
  return { period, anchor: offeringIso(anchor), previousAnchor: offeringIso(previousAnchor), nextAnchor: offeringIso(nextAnchor), points, summary };
}
