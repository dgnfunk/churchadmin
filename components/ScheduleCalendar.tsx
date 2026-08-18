"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventContentArg } from "@fullcalendar/core";
import { useRouter } from "next/navigation";

export type ScheduleCalendarEvent = {
  id: string;
  title: string;
  start: string;
  url: string;
  status: string;
  openPositions: number;
  positionCount: number;
};

export function ScheduleCalendar({ events, month }: { events: ScheduleCalendarEvent[]; month: string }) {
  const router = useRouter();
  const changeMonth = ({ view }: DatesSetArg) => {
    const nextMonth = `${view.currentStart.getFullYear()}-${String(view.currentStart.getMonth() + 1).padStart(2, "0")}`;
    if (nextMonth !== month) router.push(`/services?view=calendar&month=${nextMonth}`);
  };

  return <><div className="full-calendar-shell"><FullCalendar
    dayMaxEvents={2}
    buttonText={{ today: "Hoy", month: "Mes", list: "Lista" }}
    dateClick={(info) => router.push(`/services?view=calendar&month=${info.dateStr.slice(0, 7)}&date=${info.dateStr}#new-service`)}
    datesSet={changeMonth}
    eventContent={renderEvent}
    events={events}
    fixedWeekCount={false}
    headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
    locale="es"
    initialDate={`${month}-01`}
    initialView="dayGridMonth"
    plugins={[dayGridPlugin, interactionPlugin]}
    showNonCurrentDates
  /></div><div className="mobile-calendar-list">{events.length ? events.map((event) => <a href={event.url} key={event.id}><div><strong>{new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(event.start))}</strong><span>{new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" }).format(new Date(event.start))}</span></div><section><strong>{event.title}</strong><span>{event.positionCount ? event.openPositions ? `${event.openPositions} puestos disponibles` : "Equipo completo" : "Sin puestos configurados"}</span></section></a>) : <p>No hay servicios este mes.</p>}</div></>;
}

function renderEvent(info: EventContentArg) {
  const { openPositions, positionCount, status } = info.event.extendedProps as Pick<ScheduleCalendarEvent, "openPositions" | "positionCount" | "status">;
  const staffing = !positionCount ? "Sin puestos" : openPositions ? `${openPositions} disponibles` : "Equipo completo";
  return <div className="fc-service-event"><div><span className={`fc-status status-${status.toLowerCase()}`} />{info.timeText}</div><strong>{info.event.title}</strong><small>{staffing}</small></div>;
}
