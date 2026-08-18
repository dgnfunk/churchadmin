import { NextResponse } from "next/server";
import { revokeAttendeeSession } from "@/lib/attendee-auth";

export async function POST(request: Request) {
  await revokeAttendeeSession();
  const redirectTo = new URL("/welcome?forgot=1", request.url);
  return NextResponse.redirect(redirectTo, 303);
}
