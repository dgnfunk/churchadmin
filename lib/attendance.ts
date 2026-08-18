import type { AttendanceRecord, AttendanceSession, Person } from "./domain";

export function summarizeAttendance(
  session: AttendanceSession,
  people: Person[],
  records: AttendanceRecord[]
) {
  const sessionRecords = records.filter((record) => record.sessionId === session.id);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const members = sessionRecords.filter((record) => peopleById.get(record.personId)?.personType === "MEMBER");
  const visitors = sessionRecords.filter((record) => peopleById.get(record.personId)?.personType === "VISITOR");

  return {
    total: sessionRecords.length,
    members: members.length,
    visitors: visitors.length,
    manual: sessionRecords.filter((record) => record.source === "MANUAL").length,
    qr: sessionRecords.filter((record) => record.source === "QR").length
  };
}

export function markAttendance(
  records: AttendanceRecord[],
  input: Omit<AttendanceRecord, "id" | "checkedInAt">
): AttendanceRecord[] {
  const alreadyCheckedIn = records.some(
    (record) => record.sessionId === input.sessionId && record.personId === input.personId
  );

  if (alreadyCheckedIn) {
    return records;
  }

  return [
    ...records,
    {
      ...input,
      id: `attendance-${records.length + 1}`,
      checkedInAt: new Date().toISOString()
    }
  ];
}
