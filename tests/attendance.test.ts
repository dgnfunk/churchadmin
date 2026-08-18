import { describe, expect, it } from "vitest";
import { markAttendance, summarizeAttendance } from "@/lib/attendance";
import { attendanceRecords, attendanceSessions, people } from "@/lib/sample-data";

describe("attendance", () => {
  it("summarizes members, visitors, and check-in source", () => {
    const summary = summarizeAttendance(attendanceSessions[0], people, attendanceRecords);

    expect(summary).toMatchObject({
      total: 3,
      members: 2,
      visitors: 1,
      manual: 1,
      qr: 2
    });
  });

  it("prevents duplicate attendance records for the same session and person", () => {
    const nextRecords = markAttendance(attendanceRecords, {
      sessionId: "session-1",
      personId: "person-1",
      source: "QR"
    });

    expect(nextRecords).toHaveLength(attendanceRecords.length);
  });
});
