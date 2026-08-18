import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const church = await prisma.church.findUnique({ where: { slug: process.env.CHURCH_SLUG ?? "grace-community" }, select: { name: true } });
  return <main className="check-in-page"><header className="check-in-brand"><span>{church?.name ?? "ChurchAdmin"}</span><h1>Registro de asistencia</h1><p>Escanea el QR del servicio actual para registrar tu asistencia.</p></header><section className="check-in-card welcome-actions"><div className="phone-qr-mark">▦</div><h2>Listo para el próximo servicio</h2><p>Tu identidad puede permanecer en este dispositivo para que los próximos registros sean automáticos.</p><form action="/check-in/api/forget" method="post"><button className="button" type="submit">Olvidar este dispositivo</button></form></section></main>;
}
