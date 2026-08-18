"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttendanceTrendPoint } from "@/lib/domain";

export function AttendanceTrendChart({ points }: { points: AttendanceTrendPoint[] }) {
  if (!points.length) return <div className="empty-state chart-empty"><strong>No hay servicios en este periodo</strong><span>Elige otro periodo o crea una sesión de asistencia.</span></div>;
  return <div className="attendance-chart" aria-label="Gráfica de tendencia de asistencia">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 12, right: 18, bottom: 8, left: -18 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="total" name="Total" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="members" name="Miembros" stroke="var(--accent)" strokeWidth={2} />
        <Line type="monotone" dataKey="visitors" name="Visitantes" stroke="#2563eb" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
