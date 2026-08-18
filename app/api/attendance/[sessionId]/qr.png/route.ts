import QRCode from "qrcode";
import { requireScope } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicCheckInUrl } from "@/lib/public-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireScope("attendance");
  const { sessionId } = await params;
  const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, churchId: user.churchId }, select: { qrToken: true } });
  if (!session) return new Response("Not found", { status: 404 });
  const image = await QRCode.toBuffer(publicCheckInUrl(session.qrToken), { type: "png", width: 1024, margin: 3, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "Content-Disposition": `inline; filename="attendance-${sessionId}.png"` } });
}
