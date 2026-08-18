"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OfferingTrendPoint } from "@/lib/domain";
import { formatMoneyMinor } from "@/lib/offering-money";

export function OfferingTrendChart({ points, currencyCode }: { points: OfferingTrendPoint[]; currencyCode: string }) {
  if (!points.length) return <div className="empty-state chart-empty"><strong>No hay servicios en este período</strong><span>Elige otro período o completa servicios para comenzar el historial.</span></div>;
  const data = points.map((point) => ({ ...point, amount: Number(point.amountMinor) }));
  return <div className="attendance-chart" aria-label="Gráfica de tendencia de ofrendas">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 18, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(value) => formatMoneyMinor(BigInt(Math.round(Number(value))), currencyCode)} tickLine={false} axisLine={false} width={92} />
        <Tooltip formatter={(value) => [formatMoneyMinor(BigInt(Math.round(Number(value))), currencyCode), "Ofrendas"]} />
        <Bar dataKey="amount" name="Ofrendas" fill="var(--primary)" radius={[7, 7, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
