import { NextResponse } from "next/server";
import { CheckInError, identifyAndCheckIn } from "@/lib/attendee-check-in";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ qrToken: string }> }) {
  try {
    const { qrToken } = await params;
    const body = await request.json() as { contact?: string; mode?: string; name?: string; whatsappConsent?: boolean };
    const mode = body.mode === "visitor" ? "visitor" : "existing";
    const result = await identifyAndCheckIn({ request, qrToken, mode, contact: body.contact ?? "", name: body.name, whatsappConsent: body.whatsappConsent === true });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof CheckInError ? error : new CheckInError("Check-in could not be completed.", 500, "server_error");
    return NextResponse.json({ error: known.message, code: known.code }, { status: known.status, headers: { "Cache-Control": "no-store" } });
  }
}
