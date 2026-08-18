import { requirePermission } from "@/lib/auth";
import { stringList } from "@/lib/database-compat";
import { prisma } from "@/lib/prisma";
function csv(value: unknown) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export async function GET() { const user = await requirePermission("people.view"); const people = await prisma.person.findMany({ where: { churchId: user.churchId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }); const rows = [["firstName", "lastName", "email", "phone", "personType", "status", "familyNotes", "tags"], ...people.map((person) => [person.firstName, person.lastName, person.email, person.phone, person.personType, person.status, person.familyNotes, stringList(person.tags).join("|")])]; return new Response(rows.map((row) => row.map(csv).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=people.csv" } }); }
