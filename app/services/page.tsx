import Link from "next/link";
import { CalendarDays, List, Plus, UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ScheduleCalendar, type ScheduleCalendarEvent } from "@/components/ScheduleCalendar";
import { CreateServiceForm } from "@/components/CreateServiceForm";
import { getScheduleData } from "@/lib/schedule-actions";
import { formatServiceDate, serviceStatusLabels, type ServicesView } from "@/lib/ui-labels";

function requestedMonth(value?: string) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "")) return value!;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function localEventStart(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:00`;
}

function defaultServiceDate(month: string) {
  const [year, index] = month.split("-").map(Number);
  const today = new Date();
  const start = year === today.getFullYear() && index === today.getMonth() + 1 ? today.getDate() : 1;
  const candidate = new Date(Date.UTC(year, index - 1, start));
  candidate.setUTCDate(candidate.getUTCDate() + ((7 - candidate.getUTCDay()) % 7));
  return candidate.getUTCMonth() === index - 1 ? candidate.toISOString().slice(0, 10) : `${month}-01`;
}

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; date?: string }> }) {
  const params = await searchParams;
  const view: ServicesView = params.view === "list" || params.view === "mine" ? params.view : "calendar";
  const month = requestedMonth(params.month);
  const data = await getScheduleData(month);
  const { user, manages, services, timeZone } = data;
  const shown = view === "mine" && user.personId
    ? services.filter((service) => service.serviceSlots.some((slot) => slot.assignments.some((assignment) => assignment.personId === user.personId) || slot.proposals.some((proposal) => proposal.personId === user.personId)))
    : services;
  const events: ScheduleCalendarEvent[] = shown.map((service) => {
    const openPositions = service.serviceSlots.filter((slot) => !slot.assignments.some((assignment) => assignment.kind === "PRIMARY" && ["PENDING_CONFIRMATION", "CONFIRMED"].includes(assignment.status))).length;
    return { id: service.id, title: service.title, start: localEventStart(service.serviceAt, timeZone), url: `/services/${service.id}?tab=resumen`, status: service.status, openPositions, positionCount: service.serviceSlots.length };
  });

  const views = [
    { value: "calendar", label: "Calendario", icon: CalendarDays },
    { value: "list", label: "Lista", icon: List },
    { value: "mine", label: "Mis servicios", icon: UserRound },
  ] as const;

  return <>
    <PageHeader title="Servicios" subtitle="Planifica cada semana, coordina al equipo y prepara el contenido del servicio." actions={<div className="header-actions"><nav aria-label="Vista de servicios" className="segmented">{views.map((item) => { const Icon = item.icon; return <Link aria-current={view === item.value ? "page" : undefined} className={view === item.value ? "active" : ""} href={`/services?view=${item.value}&month=${month}`} key={item.value}><Icon />{item.label}</Link>; })}</nav>{manages ? <a className="button primary" href="#nuevo-servicio"><Plus />Nuevo servicio</a> : null}</div>} />
    <section className={`content services-index ${view === "calendar" && manages ? "calendar-composer" : ""}`}>
      {view === "calendar" ? <ScheduleCalendar events={events} month={month} /> : shown.length ? <div className="service-index-list">{shown.map((service) => {
        const positions = service.serviceSlots.length;
        const staffed = service.serviceSlots.filter((slot) => slot.assignments.some((assignment) => assignment.kind === "PRIMARY" && ["PENDING_CONFIRMATION", "CONFIRMED"].includes(assignment.status))).length;
        return <Link className="service-index-row" href={`/services/${service.id}?tab=resumen`} key={service.id}><div><span className={`status-badge status-${service.status.toLowerCase()}`}>{serviceStatusLabels[service.status]}</span><h2>{service.title}</h2><p>{formatServiceDate(service.serviceAt, timeZone)}</p></div><div className="service-row-stats"><span><strong>{service.items?.length ?? 0}</strong> elementos</span><span><strong>{staffed}/{positions}</strong> puestos cubiertos</span></div></Link>;
      })}</div> : <div className="empty-state page-empty"><CalendarDays /><h2>No hay servicios en este período</h2><p>{manages ? "Crea el primer servicio y agrega los puestos habituales del equipo." : "Tus servicios publicados y asignaciones aparecerán aquí."}</p></div>}

      {manages ? <CreateServiceForm defaultDate={/^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : defaultServiceDate(month)} /> : null}
    </section>
  </>;
}
