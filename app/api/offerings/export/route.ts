import { requireUser } from "@/lib/auth";
import type { OfferingTrendPeriod } from "@/lib/domain";
import { getOfferingExportRows } from "@/lib/offering-data";
import { minorToDecimal } from "@/lib/offering-money";
import { canAccess } from "@/lib/permissions";
import { offeringIso } from "@/lib/offering-reporting-core";

function csv(value: string | number) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

export async function GET(request: Request) {
  const user = await requireUser();
  if (!canAccess(user, "offerings.audit.view")) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period");
  const period = (["month", "quarter", "semester", "year"].includes(rawPeriod ?? "") ? rawPeriod : "month") as OfferingTrendPeriod;
  const result = await getOfferingExportRows(user.churchId, period, url.searchParams.get("anchor") ?? undefined);
  const formatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: result.timeZone });
  const rows = [["service_id", "servicio", "fecha", "estado", "monto", "moneda", "confirmado_por", "confirmado_en", "ultima_correccion"], ...result.rows.map((row) => [row.servicePlanId, row.title, formatter.format(row.serviceAt), row.amountMinor === undefined ? "SIN_CAPTURA" : "CONFIRMADA", row.amountMinor === undefined ? "" : minorToDecimal(row.amountMinor, row.currencyCode), row.currencyCode, row.confirmedBy ?? "", row.confirmedAt ? formatter.format(row.confirmedAt) : "", row.correctedAt ? formatter.format(row.correctedAt) : ""])];
  const body = `\uFEFF${rows.map((row) => row.map(csv).join(",")).join("\n")}`;
  return new Response(body, { headers: { "cache-control": "private, no-store", "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ofrendas-${period}-${offeringIso(result.anchor)}.csv"` } });
}
