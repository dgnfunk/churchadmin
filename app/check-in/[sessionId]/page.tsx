import { CheckInClient } from "@/components/CheckInClient";
import { getCurrentAttendee } from "@/lib/attendee-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CheckInPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ confirmed?: string; already?: string }> }) {
  const { sessionId } = await params;
  const query = await searchParams;
  const session = await prisma.attendanceSession.findUnique({
    where: { qrToken: sessionId },
    select: { qrToken: true, title: true, serviceAt: true, status: true, expiresAt: true, churchId: true, church: { select: { name: true, timeZone: true } } }
  });
  if (!session) return <PublicStatus title="No encontramos este QR" message="Solicita a un voluntario el código vigente del servicio." />;
  const isOpen = session.status === "OPEN" && (!session.expiresAt || session.expiresAt > new Date());
  if (!isOpen) return <PublicStatus title="El check-in está cerrado" message="Un voluntario todavía puede registrar tu asistencia manualmente." />;
  if (query.confirmed === "1") return <PublicStatus title={query.already === "1" ? "Ya habías registrado tu asistencia" : "Asistencia registrada"} message="Tu asistencia quedó registrada para este servicio." />;
  const attendee = await getCurrentAttendee(session.churchId);
  return <main className="check-in-page"><header className="check-in-brand"><span>{session.church.name}</span><h1>{session.title}</h1><p>{new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: session.church.timeZone }).format(session.serviceAt)}</p></header><section className="check-in-card"><CheckInClient hasIdentity={Boolean(attendee)} qrToken={session.qrToken} />{attendee ? <noscript><form action={`/check-in/api/${session.qrToken}`} method="post"><button className="button primary check-in-submit" type="submit">Confirmar asistencia</button></form></noscript> : null}</section></main>;
}

function PublicStatus({ title, message }: { title: string; message: string }) {
  return <main className="check-in-page"><section className="check-in-card check-in-result"><h1>{title}</h1><p>{message}</p></section></main>;
}
