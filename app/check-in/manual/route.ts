import { NextResponse } from "next/server";
import { CheckInError, consumeAttendeeRateLimit, requireOpenManualSession } from "@/lib/attendee-check-in";
import { normalizeManualCheckInCode } from "@/lib/manual-check-in-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const manualCode = normalizeManualCheckInCode(String(formData.get("code") ?? ""));
    const session = await requireOpenManualSession(manualCode);
    await consumeAttendeeRateLimit(request, session.churchId, manualCode, "attendee-manual-code", 20);
    return NextResponse.redirect(new URL(`/check-in/${encodeURIComponent(session.qrToken)}`, request.url), 303);
  } catch (error) {
    console.error(JSON.stringify({
      event: "manual_check_in_code_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }));
    const reason = error instanceof CheckInError && error.code === "rate_limited" ? "rate-limited" : "invalid";
    return NextResponse.redirect(new URL(`/check-in?error=${reason}`, request.url), 303);
  }
}
