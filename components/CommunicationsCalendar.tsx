"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { DatesSetArg, EventContentArg } from "@fullcalendar/core";
import { useRouter } from "next/navigation";

export type CommunicationCalendarEvent = { id: string; title: string; start: string; url: string; status: string; channels: string[] };

export function CommunicationsCalendar({ events, month }: { events: CommunicationCalendarEvent[]; month: string }) {
  const router = useRouter();
  return <div className="full-calendar-shell"><FullCalendar
    dayMaxEvents={3}
    datesSet={({ view }: DatesSetArg) => {
      const next = `${view.currentStart.getFullYear()}-${String(view.currentStart.getMonth() + 1).padStart(2, "0")}`;
      if (next !== month) router.push(`/communications?view=calendar&month=${next}`);
    }}
    eventContent={(info: EventContentArg) => {
      const details = info.event.extendedProps as Pick<CommunicationCalendarEvent, "status" | "channels">;
      return <div className="fc-service-event"><div><span className={`fc-status communication-${details.status.toLowerCase()}`} />{info.timeText}</div><strong>{info.event.title}</strong><small>{details.channels.map(channelLabel).join(" · ")}</small></div>;
    }}
    events={events}
    fixedWeekCount={false}
    headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
    initialDate={`${month}-01`}
    initialView="dayGridMonth"
    locale="es"
    plugins={[dayGridPlugin]}
  /></div>;
}

function channelLabel(value: string) { return value === "WHATSAPP" ? "WhatsApp" : value === "FACEBOOK" ? "Facebook" : "Instagram"; }
