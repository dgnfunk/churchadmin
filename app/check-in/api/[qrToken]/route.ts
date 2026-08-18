import { NextResponse } from "next/server";
import { getCurrentAttendee, renewAttendeeSession } from "@/lib/attendee-auth";
import { CheckInError, consumeAttendeeRateLimit, recordQrAttendance, requireOpenQrSession } from "@/lib/attendee-check-in";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ qrToken: string }> }) {
  try {
    const { qrToken } = await params;
    const session = await requireOpenQrSession(qrToken);
    await consumeAttendeeRateLimit(request, session.churchId, qrToken, "attendee-auto", 60);
    const attendee = await getCurrentAttendee(session.churchId);
    if (!attendee) throw new CheckInError("Identify yourself to continue.", 401, "identity_required");
    const attendance = await recordQrAttendance(session.id, attendee.personId);
    await renewAttendeeSession(attendee.id);
    if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      return NextResponse.redirect(new URL(`/check-in/${qrToken}?confirmed=1&already=${attendance.alreadyCheckedIn ? "1" : "0"}`, request.url), 303);
    }
    return NextResponse.json({ ...attendance, firstName: attendee.person.firstName }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof CheckInError ? error : new CheckInError("Check-in could not be completed.", 500, "server_error");
    return NextResponse.json({ error: known.message, code: known.code }, { status: known.status, headers: { "Cache-Control": "no-store" } });
  }
}
