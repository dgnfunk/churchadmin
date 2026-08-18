import { requirePermission } from "@/lib/auth";
import { getAttendanceReport } from "@/lib/attendance-reporting";
import type { AttendanceTrendPeriod } from "@/lib/domain";

function csv(value: string | number) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

export async function GET(request: Request) {
  const user = await requirePermission("attendance.analytics.view");
  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period");
  const period = (["month", "semester", "year"].includes(rawPeriod ?? "") ? rawPeriod : "month") as AttendanceTrendPeriod;
  const report = await getAttendanceReport(user.churchId, period, url.searchParams.get("anchor") ?? undefined);
  const body = [["period", "label", "services", "total", "members", "visitors"], ...report.points.map((point) => [point.key, point.label, point.serviceCount, point.total, point.members, point.visitors])].map((row) => row.map(csv).join(",")).join("\n");
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendance-${period}-${report.anchor}.csv"` } });
}
