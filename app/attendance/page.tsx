import Link from "next/link";
import { BarChart3, CalendarClock, CheckCircle2, Plus, UserPlus } from "lucide-react";
import { AttendanceTrendChart } from "@/components/AttendanceTrendChart";
import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { QrCodePanel } from "@/components/QrCodePanel";
import { requireUser } from "@/lib/auth";
import type { AttendanceTrendPeriod } from "@/lib/domain";
import { getAttendanceHistory, getAttendanceReport } from "@/lib/attendance-reporting";
import { canAccess, hasServicePermission } from "@/lib/permissions";
import { getAttendanceData } from "@/lib/people-attendance-data";
import { createAttendanceSessionAction, createVisitorAndMarkAttendanceAction, markManualAttendanceAction, removeAttendanceRecordAction, setAttendanceSessionStatusAction } from "@/lib/people-attendance-actions";
import { prisma } from "@/lib/prisma";
import { publicCheckInUrl, publicManualCheckInUrl } from "@/lib/public-url";
import { formatServiceDate, personTypeLabels } from "@/lib/ui-labels";
import { redirect } from "next/navigation";

type AttendanceView = "check-in" | "history" | "trends";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ view?: string; sessionId?: string; servicePlanId?: string; period?: string; anchor?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const view: AttendanceView = params.view === "history" || params.view === "trends" ? params.view : "check-in";
  const period = (["month", "semester", "year"].includes(params.period ?? "") ? params.period : "month") as AttendanceTrendPeriod;
  if (view === "trends" && !canAccess(user, "attendance.analytics.view")) redirect("/");
  if (view === "history" && !canAccess(user, "attendance.history.view")) redirect("/");
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { timeZone: true } });
  const views = [
    { key: "check-in", label: "Check-in", visible: canAccess(user, "attendance.checkin.manual") || canAccess(user, "attendance.sessions.manage") },
    { key: "history", label: "Historial", visible: canAccess(user, "attendance.history.view") },
    { key: "trends", label: "Tendencias", visible: canAccess(user, "attendance.analytics.view") },
  ].filter((item) => item.visible);
  const tabs = <nav aria-label="Vistas de asistencia" className="segmented">{views.map((item) => <Link aria-current={view === item.key ? "page" : undefined} className={view === item.key ? "active" : ""} href={`/attendance?view=${item.key}`} key={item.key}>{item.label}</Link>)}</nav>;

  if (view === "trends") {
    const report = await getAttendanceReport(user.churchId, period, params.anchor);
    const [selectedYear, selectedMonth] = report.anchor.split("-").map(Number);
    const yearOptions = Array.from({ length: 11 }, (_, index) => selectedYear - 5 + index);
    const periodLabels = { month: "Mes", semester: "Semestre", year: "Año" };
    return <><PageHeader title="Tendencias de asistencia" subtitle={`Períodos calculados en la zona ${report.timeZone}.`} actions={tabs} /><section className="content grid"><div className="report-toolbar"><nav className="segmented">{(["month", "semester", "year"] as const).map((value) => <Link className={period === value ? "active" : ""} href={`/attendance?view=trends&period=${value}&anchor=${report.anchor}`} key={value}>{periodLabels[value]}</Link>)}</nav><div className="actions"><form className="actions" method="get"><input name="view" type="hidden" value="trends" /><input name="period" type="hidden" value={period} /><label className="sr-only" htmlFor="trend-year">Año</label><select defaultValue={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`} id="trend-year" name="anchor">{yearOptions.map((year) => <option key={year} value={`${year}-${String(selectedMonth).padStart(2, "0")}-01`}>{year}</option>)}</select><button className="button">Ir</button></form><Link aria-label="Período anterior" className="button icon" href={`/attendance?view=trends&period=${period}&anchor=${report.previousAnchor}`}>←</Link><Link aria-label="Período siguiente" className="button icon" href={`/attendance?view=trends&period=${period}&anchor=${report.nextAnchor}`}>→</Link><a className="button" href={`/api/attendance/export?period=${period}&anchor=${report.anchor}`}>Exportar CSV</a></div></div><div className="grid five"><TrendMetric label="Asistencia acumulada" value={report.summary.total} /><TrendMetric label="Promedio por servicio" value={report.summary.averagePerService} /><TrendMetric label="Máximo" value={report.summary.peak} /><TrendMetric label="Visitantes" value={report.summary.visitors} /><TrendMetric label="Período anterior" value={report.summary.changePercent == null ? "—" : `${report.summary.changePercent}%`} /></div><div className="panel"><div className="section-heading"><div><h2>Asistencia en el tiempo</h2><p className="muted">Total, miembros y visitantes.</p></div><BarChart3 /></div><AttendanceTrendChart points={report.points} /></div></section></>;
  }

  const history = canAccess(user, "attendance.history.view") || canAccess(user, "attendance.sessions.manage") ? await getAttendanceHistory(user.churchId) : [];
  if (view === "history") return <><PageHeader title="Historial de asistencia" subtitle="Consulta cada servicio y abre el detalle de sus registros." actions={tabs} /><section className="content"><div className="table-scroll operational-table"><table className="table"><thead><tr><th>Servicio</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Miembros</th><th>Visitantes</th><th>QR / Manual</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{history.map((row) => <tr key={row.id}><td><strong>{row.title}</strong></td><td>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: church.timeZone }).format(new Date(row.serviceAt))}</td><td><span className={`status-badge ${row.status === "OPEN" ? "status-published" : ""}`}>{row.status === "OPEN" ? "Abierta" : "Cerrada"}</span></td><td>{row.total}</td><td>{row.members}</td><td>{row.visitors}</td><td>{row.qr} / {row.manual}</td><td><Link className="button" href={`/attendance?view=check-in&sessionId=${row.id}`}>Abrir</Link></td></tr>)}</tbody></table></div></section></>;

  const selectedSessionId = params.sessionId ?? history[0]?.id;
  const selectedAccess = selectedSessionId ? await prisma.attendanceSession.findFirst({ where: { id: selectedSessionId, churchId: user.churchId }, select: { servicePlanId: true } }) : null;
  const canOpenCheckIn = canAccess(user, "attendance.sessions.manage") || canAccess(user, "attendance.checkin.manual") || Boolean(selectedAccess?.servicePlanId && await hasServicePermission(user, "attendance.checkin.manual", selectedAccess.servicePlanId));
  if (!canOpenCheckIn) redirect("/");
  const { people, records, sessions } = await getAttendanceData(selectedSessionId, user.churchId);
  const session = sessions[0];
  const canManageSessions = canAccess(user, "attendance.sessions.manage");
  const plans = canManageSessions ? await prisma.servicePlan.findMany({ where: { churchId: user.churchId, attendanceSession: null }, orderBy: { serviceAt: "desc" }, select: { id: true, title: true, serviceAt: true } }) : [];
  if (!session) {
    if (!canManageSessions) redirect("/services?view=mine");
    return <><PageHeader title="Asistencia" subtitle="Crea la primera sesión de check-in." actions={tabs} /><section className="content"><ActionForm action={createAttendanceSessionAction} className="creation-band" successMessage="La sesión de asistencia se creó correctamente."><div><span className="eyebrow">Nueva sesión</span><h2>Vincular asistencia con un servicio</h2><p>El QR y el registro manual usarán la fecha del servicio seleccionado.</p></div><div className="actions"><select defaultValue={params.servicePlanId ?? ""} name="servicePlanId"><option value="">Próximo domingo</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title} · {formatServiceDate(plan.serviceAt, church.timeZone, false)}</option>)}</select><button className="button primary" type="submit"><Plus />Crear sesión</button></div></ActionForm></section></>;
  }

  const sessionRecords = records.filter((record) => record.sessionId === session.id);
  return <><PageHeader title="Check-in de asistencia" subtitle={session.title} actions={tabs} /><section className="content attendance-checkin-layout"><div className="attendance-main"><div className="session-status-band"><div><span className={`status-badge ${session.status === "OPEN" ? "status-published" : ""}`}>{session.status === "OPEN" ? "Sesión abierta" : "Sesión cerrada"}</span><h2>{formatServiceDate(session.serviceAt, church.timeZone, false)}</h2><p>{sessionRecords.length} personas registradas</p></div>{canManageSessions ? <ActionForm action={setAttendanceSessionStatusAction} confirmMessage={session.status === "OPEN" ? "¿Cerrar esta sesión de asistencia? El QR dejará de aceptar registros." : undefined}><input name="sessionId" type="hidden" value={session.id} /><input name="status" type="hidden" value={session.status === "OPEN" ? "CLOSED" : "OPEN"} /><button className={session.status === "OPEN" ? "button danger" : "button primary"} type="submit">{session.status === "OPEN" ? "Cerrar sesión" : "Reabrir sesión"}</button></ActionForm> : null}</div><div className="table-scroll operational-table"><table className="table"><thead><tr><th>Persona</th><th>Tipo</th><th>Origen</th><th>Hora</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{sessionRecords.map((record) => { const person = people.find((candidate) => candidate.id === record.personId); return <tr key={record.id}><td><strong>{person?.firstName} {person?.lastName}</strong></td><td>{person ? personTypeLabels[person.personType] : "—"}</td><td>{record.source === "QR" ? "QR" : "Manual"}</td><td>{new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: church.timeZone }).format(new Date(record.checkedInAt))}</td><td><ActionForm action={removeAttendanceRecordAction} confirmMessage={`¿Retirar la asistencia de ${person?.firstName ?? "esta persona"}?`}><input name="recordId" type="hidden" value={record.id} /><button aria-label="Retirar asistencia" className="button icon danger" type="submit">×</button></ActionForm></td></tr>; })}</tbody></table></div></div><aside className="attendance-tools">{canManageSessions ? <QrCodePanel manualCode={session.manualCode} manualUrl={publicManualCheckInUrl()} publicUrl={publicCheckInUrl(session.qrToken)} sessionId={session.id} /> : null}<details className="panel action-disclosure" open><summary><CheckCircle2 />Registrar persona existente</summary><ActionForm action={markManualAttendanceAction} className="form-grid" successMessage="La asistencia quedó registrada."><input name="sessionId" type="hidden" value={session.id} /><div className="field"><label htmlFor="person">Persona</label><select id="person" name="personId" required><option value="">Selecciona una persona</option>{people.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select></div><div className="field"><label htmlFor="notes">Notas</label><textarea id="notes" maxLength={1000} name="notes" /></div><button className="button primary" type="submit">Marcar presente</button></ActionForm></details><details className="panel action-disclosure"><summary><UserPlus />Registrar visitante nuevo</summary><ActionForm action={createVisitorAndMarkAttendanceAction} className="form-grid" successMessage="El visitante fue creado y registrado."><input name="sessionId" type="hidden" value={session.id} /><div className="field"><label htmlFor="visitor-name-admin">Nombre completo</label><input autoComplete="name" id="visitor-name-admin" maxLength={160} minLength={2} name="name" required /></div><div className="field"><label htmlFor="visitor-contact-admin">Correo o teléfono</label><input autoComplete="email tel" id="visitor-contact-admin" maxLength={254} name="contact" /></div><button className="button primary" type="submit">Crear y registrar</button></ActionForm></details></aside></section></>;
}

function TrendMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="panel metric"><strong>{value}</strong><span>{label}</span></div>;
}
