import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, ListChecks, QrCode, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { getAttendanceReport } from "@/lib/attendance-reporting";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatServiceDate, serviceStatusLabels } from "@/lib/ui-labels";

export default async function DashboardPage() {
  const user = await requireUser();
  const canViewServices = canAccess(user, "services.view") || canAccess(user, "schedule.view.own");
  const canViewAttendance = canAccess(user, "attendance.history.view");
  const canViewAnalytics = canAccess(user, "attendance.analytics.view");
  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { timeZone: true } });
  const now = new Date();
  const service = canViewServices ? await prisma.servicePlan.findFirst({
    where: { churchId: user.churchId, status: { notIn: ["COMPLETED", "CANCELLED"] }, serviceAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) }, ...(!canAccess(user, "services.view") && user.personId ? { serviceSlots: { some: { assignments: { some: { personId: user.personId, status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] } } } } } } : {}) },
    include: { items: true, attendanceSession: { select: { id: true, status: true } }, serviceSlots: { include: { assignments: true } }, exportJobs: { where: { status: "COMPLETE" }, select: { id: true }, take: 1 } },
    orderBy: { serviceAt: "asc" },
  }) : null;
  const latestAttendance = canViewAttendance ? await prisma.attendanceSession.findFirst({ where: { churchId: user.churchId, serviceAt: { lte: now } }, include: { records: { include: { person: { select: { personType: true } } } } }, orderBy: { serviceAt: "desc" } }) : null;
  const monthlyTrend = canViewAnalytics ? await getAttendanceReport(user.churchId, "month") : null;

  if (!service && !canViewAttendance) return <><PageHeader title={`Hola, ${user.name.split(" ")[0]}`} subtitle="Tu espacio de trabajo personal." /><section className="content"><div className="empty-state page-empty"><CalendarDays /><h2>No tienes servicios próximos</h2><p>Tus asignaciones y oportunidades para servir aparecerán en Mis servicios.</p><Link className="button primary" href="/services?view=mine">Abrir mis servicios</Link></div></section></>;

  const active = (status: string) => ["PENDING_CONFIRMATION", "CONFIRMED"].includes(status);
  const staffed = service?.serviceSlots.filter((slot) => slot.assignments.some((assignment) => assignment.kind === "PRIMARY" && active(assignment.status))).length ?? 0;
  const confirmed = service?.serviceSlots.filter((slot) => slot.assignments.some((assignment) => assignment.kind === "PRIMARY" && assignment.status === "CONFIRMED")).length ?? 0;
  const duration = service?.items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0) ?? 0;
  const latestTotal = latestAttendance?.records.length ?? 0;
  const latestMembers = latestAttendance?.records.filter((record) => record.person.personType === "MEMBER").length ?? 0;
  const latestVisitors = latestTotal - latestMembers;

  return <>
    <PageHeader title={`Hola, ${user.name.split(" ")[0]}`} subtitle="Aquí está lo que necesita atención para el próximo servicio." actions={service ? <Link className="button primary" href={`/services/${service.id}?tab=resumen`}>Abrir servicio</Link> : null} />
    <section className="content dashboard-layout">
      {service ? <section className="next-service-panel"><div className="next-service-heading"><div><span className="eyebrow">Próximo servicio</span><h2>{service.title}</h2><p><CalendarDays />{formatServiceDate(service.serviceAt, church.timeZone)}</p></div><span className={`status-badge status-${service.status.toLowerCase()}`}>{serviceStatusLabels[service.status]}</span></div><div className="dashboard-readiness"><DashboardMetric icon={ListChecks} label="Contenido" value={`${service.items.length} elementos`} detail={`${duration} min estimados`} ready={service.items.length > 0} /><DashboardMetric icon={Users} label="Equipo" value={`${staffed}/${service.serviceSlots.length} cubiertos`} detail={`${confirmed} confirmados`} ready={staffed > 0 && staffed === service.serviceSlots.length} /><DashboardMetric icon={QrCode} label="Asistencia" value={service.attendanceSession ? service.attendanceSession.status === "OPEN" ? "Abierta" : "Cerrada" : "Sin sesión"} detail="Check-in del servicio" ready={Boolean(service.attendanceSession)} /><DashboardMetric icon={CheckCircle2} label="Exportación" value={service.exportJobs.length ? "Lista" : "Pendiente"} detail="Archivos del servicio" ready={service.exportJobs.length > 0} /></div><div className="dashboard-actions">{!service.items.length ? <Link href={`/services/${service.id}?tab=contenido`}><AlertTriangle />Agregar contenido</Link> : null}{staffed < service.serviceSlots.length ? <Link href={`/services/${service.id}?tab=equipo`}><AlertTriangle />Cubrir {service.serviceSlots.length - staffed} puestos</Link> : null}{!service.attendanceSession ? <Link href={`/services/${service.id}?tab=asistencia`}><AlertTriangle />Configurar asistencia</Link> : null}</div></section> : <div className="empty-state page-empty"><CalendarDays /><h2>No hay un servicio próximo</h2><p>Crea el siguiente servicio desde el calendario.</p><Link className="button primary" href="/services#nuevo-servicio">Nuevo servicio</Link></div>}

      {canViewAttendance ? <section className="dashboard-section"><div className="section-heading"><div><span className="eyebrow">Servicio más reciente</span><h2>Asistencia</h2><p>{latestAttendance ? formatServiceDate(latestAttendance.serviceAt, church.timeZone, false) : "Sin sesiones registradas"}</p></div><Link className="button" href="/attendance?view=history">Ver historial</Link></div><div className="metric-strip"><div><strong>{latestTotal}</strong><span>Total</span></div><div><strong>{latestMembers}</strong><span>Miembros</span></div><div><strong>{latestVisitors}</strong><span>Visitantes</span></div></div></section> : null}

      {monthlyTrend ? <section className="dashboard-section"><div className="section-heading"><div><span className="eyebrow">Este mes</span><h2>Tendencia de asistencia</h2><p>{monthlyTrend.summary.serviceCount} servicios realizados</p></div><Link className="button" href="/attendance?view=trends&period=month"><TrendingUp />Abrir tendencias</Link></div><div className="metric-strip"><div><strong>{monthlyTrend.summary.total}</strong><span>Asistencia acumulada</span></div><div><strong>{monthlyTrend.summary.averagePerService}</strong><span>Promedio por servicio</span></div><div><strong>{monthlyTrend.summary.visitors}</strong><span>Visitantes</span></div></div></section> : null}
    </section>
  </>;
}

function DashboardMetric({ icon: Icon, label, value, detail, ready }: { icon: typeof Clock3; label: string; value: string; detail: string; ready: boolean }) {
  return <div className="dashboard-metric"><span className={ready ? "ready" : ""}>{ready ? <CheckCircle2 /> : <Icon />}</span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></div>;
}
