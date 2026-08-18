import type { AttendanceRecord, AttendanceSession, Person } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { stringList } from "@/lib/database-compat";

export interface AttendanceData {
  people: Person[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
}

function serializePerson(person: {
  id: string;
  churchId: string;
  personType: "MEMBER" | "VISITOR";
  status: "ACTIVE" | "INACTIVE" | "FOLLOW_UP";
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  familyNotes: string | null;
  tags: unknown;
}): Person {
  return {
    id: person.id,
    churchId: person.churchId,
    personType: person.personType,
    status: person.status,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email ?? undefined,
    phone: person.phone ?? undefined,
    familyNotes: person.familyNotes ?? undefined,
    tags: stringList(person.tags)
  };
}

function serializeSession(session: {
  id: string;
  churchId: string;
  title: string;
  serviceAt: Date;
  qrToken: string;
  manualCode: string;
  servicePlanId: string | null;
  status: "OPEN" | "CLOSED";
  expiresAt: Date | null;
  closedAt: Date | null;
}): AttendanceSession {
  return {
    id: session.id,
    churchId: session.churchId,
    title: session.title,
    serviceAt: session.serviceAt.toISOString(),
    qrToken: session.qrToken,
    manualCode: session.manualCode,
    servicePlanId: session.servicePlanId ?? undefined
    ,status: session.status
    ,expiresAt: session.expiresAt?.toISOString()
    ,closedAt: session.closedAt?.toISOString()
  };
}

function serializeRecord(record: {
  id: string;
  sessionId: string;
  personId: string;
  source: "MANUAL" | "QR";
  checkedInAt: Date;
  notes: string | null;
}): AttendanceRecord {
  return {
    id: record.id,
    sessionId: record.sessionId,
    personId: record.personId,
    source: record.source,
    checkedInAt: record.checkedInAt.toISOString(),
    notes: record.notes ?? undefined
  };
}

export async function getPeople(churchId?: string): Promise<Person[]> {
    const church = await prisma.church.findUnique({
      where: churchId ? { id: churchId } : { slug: process.env.CHURCH_SLUG ?? "grace-community" },
      select: { id: true }
    });

    if (!church) {
      throw new Error("Church configuration was not found.");
    }

    const rows = await prisma.person.findMany({
      where: { churchId: church.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    return rows.map(serializePerson);
}

export async function getAttendanceData(sessionId?: string, churchId?: string): Promise<AttendanceData> {
    const church = await prisma.church.findUnique({
      where: churchId ? { id: churchId } : { slug: process.env.CHURCH_SLUG ?? "grace-community" },
      select: { id: true }
    });

    if (!church) {
      throw new Error("Church configuration was not found.");
    }

    const [personRows, sessionRows] = await Promise.all([
      prisma.person.findMany({
        where: { churchId: church.id },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      prisma.attendanceSession.findMany({
        where: sessionId ? { churchId: church.id, id: sessionId } : { churchId: church.id },
        orderBy: { serviceAt: "desc" },
        take: sessionId ? undefined : 12
      })
    ]);

    const sessions = sessionRows.map(serializeSession);
    const activeSessionId = sessionId ?? sessions[0]?.id;
    const recordRows = activeSessionId
      ? await prisma.attendanceRecord.findMany({
          where: { sessionId: activeSessionId },
          orderBy: { checkedInAt: "asc" }
        })
      : [];

    return {
      people: personRows.map(serializePerson),
      sessions,
      records: recordRows.map(serializeRecord)
    };
}
