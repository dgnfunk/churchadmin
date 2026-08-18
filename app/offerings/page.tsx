import Link from "next/link";
import { Banknote, BarChart3, CheckCircle2, FileDown, History } from "lucide-react";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { OfferingTrendChart } from "@/components/OfferingTrendChart";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import type { OfferingTrendPeriod } from "@/lib/domain";
import { correctOfferingAction, confirmOfferingAction, updateOfferingCurrencyAction } from "@/lib/offering-actions";
import { getOfferingCaptureData, getOfferingHistory, getOfferingReport } from "@/lib/offering-data";
import { formatMoneyMinor, minorToDecimal } from "@/lib/offering-money";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatServiceDate } from "@/lib/ui-labels";

type OfferingView = "capture" | "history" | "trends";

export default async function OfferingsPage({ searchParams }: { searchParams: Promise<{ view?: string; servicePlanId?: string; period?: string; anchor?: string }> }) {
  const user = await requireUser();
  const canCapture = canAccess(user, "offerings.capture");
  const canAudit = canAccess(user, "offerings.audit.view");
  const isAdmin = user.role === "ADMIN";
  if (!canCapture && !canAudit) redirect("/");
  const params = await searchParams;
  const requestedView = params.view === "history" || params.view === "trends" || params.view === "capture" ? params.view : undefined;
  const view: OfferingView = requestedView ?? (canCapture ? "capture" : "history");
  if (view === "capture" && !canCapture) redirect("/offerings?view=history");
  if ((view === "history" || view === "trends") && !canAudit) redirect("/offerings?view=capture");
  const period = (["month", "quarter", "semester", "year"].includes(params.period ?? "") ? params.period : "month") as OfferingTrendPeriod;
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { timeZone: true, currencyCode: true, _count: { select: { offeringClosures: true } } } });
  const tabs = <nav aria-label="Vistas de ofrendas" className="segmented">{canCapture ? <Link className={view === "capture" ? "active" : ""} href="/offerings?view=capture">Captura</Link> : null}{canAudit ? <Link className={view === "history" ? "active" : ""} href="/offerings?view=history">Historial</Link> : null}{canAudit ? <Link className={view === "trends" ? "active" : ""} href="/offerings?view=trends">Tendencias</Link> : null}</nav>;

  if (view === "trends") {
    const report = await getOfferingReport(user.churchId, period, params.anchor);
    const [selectedYear, selectedMonth] = report.anchor.split("-").map(Number);
    const yearOptions = Array.from({ length: 11 }, (_, index) => selectedYear - 5 + index);
    const labels: Record<OfferingTrendPeriod, string> = { month: "Mes", quarter: "Trimestre", semester: "Semestre", year: "Año" };
    return <><PageHeader title="Tendencias de ofrendas" subtitle={`Períodos calendario en ${report.timeZone}.`} actions={tabs} /><section className="content grid"><div className="report-toolbar"><nav className="segmented">{(["month", "quarter", "semester", "year"] as const).map((value) => <Link className={period === value ? "active" : ""} href={`/offerings?view=trends&period=${value}&anchor=${report.anchor}`} key={value}>{labels[value]}</Link>)}</nav><div className="actions"><form className="actions" method="get"><input name="view" type="hidden" value="trends" /><input name="period" type="hidden" value={period} /><label className="sr-only" htmlFor="offering-trend-year">Año</label><select defaultValue={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`} id="offering-trend-year" name="anchor">{yearOptions.map((year) => <option key={year} value={`${year}-${String(selectedMonth).padStart(2, "0")}-01`}>{year}</option>)}</select><button className="button">Ir</button></form><Link aria-label="Período anterior" className="button icon" href={`/offerings?view=trends&period=${period}&anchor=${report.previousAnchor}`}>←</Link><Link aria-label="Período siguiente" className="button icon" href={`/offerings?view=trends&period=${period}&anchor=${report.nextAnchor}`}>→</Link><a className="button" href={`/api/offerings/export?period=${period}&anchor=${report.anchor}`}><FileDown />CSV</a></div></div><div className="grid five"><OfferingMetric label="Total confirmado" value={formatMoneyMinor(report.summary.totalAmountMinor, report.currencyCode)} /><OfferingMetric label="Promedio por servicio" value={formatMoneyMinor(report.summary.averageAmountMinor, report.currencyCode)} /><OfferingMetric label="Mayor por servicio" value={formatMoneyMinor(report.summary.peakAmountMinor, report.currencyCode)} /><OfferingMetric label="Capturados / pendientes" value={`${report.summary.capturedCount} / ${report.summary.pendingCount}`} /><OfferingMetric label="Período anterior" value={report.summary.changePercent == null ? "—" : `${report.summary.changePercent}%`} /></div><div className="panel"><div className="section-heading"><div><h2>Ofrendas en el tiempo</h2><p className="muted">Los servicios sin captura no reducen el promedio.</p></div><BarChart3 /></div><OfferingTrendChart currencyCode={report.currencyCode} points={report.points} /></div></section></>;
  }

  if (view === "history") {
    const history = await getOfferingHistory(user.churchId);
    return <><PageHeader title="Historial de ofrendas" subtitle="Consulta cierres confirmados, pendientes y su auditoría." actions={tabs} /><section className="content"><div className="table-scroll operational-table"><table className="table"><thead><tr><th>Servicio</th><th>Fecha</th><th>Estado</th><th>Monto</th><th>Confirmación</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{history.map((row) => <tr key={row.id}><td><strong>{row.title}</strong></td><td>{formatServiceDate(row.serviceAt, church.timeZone, false)}</td><td>{row.offering ? <span className="status-badge status-published">Confirmada</span> : <span className="status-badge">Sin captura</span>}</td><td><strong>{row.offering ? formatMoneyMinor(row.offering.amountMinor, row.offering.currencyCode) : "—"}</strong></td><td>{row.offering ? <>{row.offering.confirmedBy}<br /><small>{formatAuditDate(row.offering.confirmedAt, church.timeZone)}</small></> : "—"}</td><td>{row.offering ? <details className="offering-details"><summary>Detalle</summary>{row.offering.note ? <p><strong>Nota:</strong> {row.offering.note}</p> : null}<h4>Auditoría</h4><ol>{row.offering.auditEvents.map((event) => <li key={event.id}><strong>{event.eventType === "CONFIRMED" ? "Confirmación" : "Corrección"}</strong> por {event.actorName} · {formatAuditDate(event.createdAt, church.timeZone)}<br /><span>{event.previousAmountMinor == null ? formatMoneyMinor(event.newAmountMinor, row.offering!.currencyCode) : `${formatMoneyMinor(event.previousAmountMinor, row.offering!.currencyCode)} → ${formatMoneyMinor(event.newAmountMinor, row.offering!.currencyCode)}`}</span>{event.reason ? <small>Motivo: {event.reason}</small> : null}</li>)}</ol>{isAdmin ? <ActionForm action={correctOfferingAction} className="form-grid compact" successMessage="La corrección quedó registrada."><input name="offeringId" type="hidden" value={row.offering.id} /><input name="expectedUpdatedAt" type="hidden" value={row.offering.updatedAt} /><label>Monto corregido<input defaultValue={minorToDecimal(row.offering.amountMinor, row.offering.currencyCode)} inputMode="decimal" name="amount" required /></label><label>Motivo<textarea maxLength={500} minLength={5} name="reason" required /></label><button className="button primary" type="submit">Guardar corrección</button></ActionForm> : null}</details> : canCapture ? <Link className="button" href={`/offerings?view=capture&servicePlanId=${row.id}`}>Capturar</Link> : null}</td></tr>)}</tbody></table></div></section></>;
  }

  const captureData = await getOfferingCaptureData(user.churchId, user.id, church.timeZone);
  const pending = captureData.pending;
  const orderedPending = params.servicePlanId ? [...pending].sort((a, b) => a.id === params.servicePlanId ? -1 : b.id === params.servicePlanId ? 1 : 0) : pending;
  return <><PageHeader title="Captura de ofrendas" subtitle="Confirma un total por cada servicio completado." actions={tabs} /><section className="content offerings-layout"><div className="offerings-main"><div className="section-heading"><div><span className="eyebrow">Pendientes</span><h2>Servicios por cerrar</h2><p>Una captura de cero cuenta como cierre confirmado.</p></div><span className="status-badge">{pending.length} pendientes</span></div>{orderedPending.length ? <div className="offering-capture-list">{orderedPending.map((row) => <article className={row.id === params.servicePlanId ? "panel offering-capture highlighted" : "panel offering-capture"} key={row.id}><div><h3>{row.title}</h3><p>{formatServiceDate(row.serviceAt, church.timeZone, false)}</p></div><ActionForm action={confirmOfferingAction} className="offering-capture-form" successMessage="La ofrenda quedó confirmada."><input name="servicePlanId" type="hidden" value={row.id} /><label>Monto ({church.currencyCode})<input autoFocus={row.id === params.servicePlanId} inputMode="decimal" name="amount" placeholder="0.00" required /></label><label>Nota interna <span className="muted">opcional</span><input maxLength={500} name="note" /></label><button className="button primary" type="submit"><CheckCircle2 />Confirmar</button></ActionForm></article>)}</div> : <div className="empty-state page-empty"><CheckCircle2 /><h2>No hay cierres pendientes</h2><p>Los próximos servicios aparecerán aquí cuando se marquen como completados.</p></div>}</div><aside className="offerings-sidebar">{isAdmin ? <section className="panel"><div className="section-heading"><div><span className="eyebrow">Configuración</span><h2>Moneda</h2></div><Banknote /></div>{church._count.offeringClosures === 0 ? <ActionForm action={updateOfferingCurrencyAction} className="form-grid compact"><label>Código ISO<input defaultValue={church.currencyCode} maxLength={3} minLength={3} name="currencyCode" required /></label><button className="button" type="submit">Guardar moneda</button></ActionForm> : <p><strong>{church.currencyCode}</strong><br /><span className="muted">Bloqueada para preservar el histórico.</span></p>}</section> : null}<section className="panel"><div className="section-heading"><div><span className="eyebrow">Mes actual</span><h2>Mis capturas</h2></div><History /></div>{captureData.ownClosures.length ? <ul className="offering-recent-list">{captureData.ownClosures.map((row) => <li key={row.id}><div><strong>{row.title}</strong><span>{formatAuditDate(row.confirmedAt, church.timeZone)}</span>{row.note ? <small>{row.note}</small> : null}</div><strong>{formatMoneyMinor(row.amountMinor, row.currencyCode)}</strong></li>)}</ul> : <p className="muted">Todavía no has confirmado ofrendas este mes.</p>}{canAudit ? <Link className="button" href="/offerings?view=history">Abrir historial</Link> : null}</section></aside></section></>;
}

function OfferingMetric({ label, value }: { label: string; value: string }) {
  return <div className="panel metric"><strong>{value}</strong><span>{label}</span></div>;
}

function formatAuditDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}
