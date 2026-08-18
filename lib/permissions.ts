import type { Permission, PermissionScope, User } from "./domain";
import { prisma } from "./prisma";
import { stringList } from "./database-compat";

export const permissions: Permission[] = [
  "attendance.checkin.manual", "attendance.sessions.manage", "attendance.history.view", "attendance.analytics.view",
  "people.view", "people.manage", "services.view", "services.content.edit", "services.present", "services.export",
  "media.manage", "schedule.view.own", "schedule.propose", "schedule.manage", "ministry.manage", "theme.manage", "users.manage",
  "communications.view", "communications.create", "communications.approve", "communications.publish",
  "communications.connections.manage", "communications.consent.manage",
  "offerings.capture", "offerings.audit.view"
];

const legacyScopePermission: Record<PermissionScope, Permission> = {
  attendance: "attendance.sessions.manage", services: "services.content.edit", theme: "theme.manage", users: "users.manage"
};

export function canAccess(user: User, permission: Permission | PermissionScope): boolean {
  if (user.role === "ADMIN") {
    return true;
  }
  const resolved = permission.includes(".") ? permission as Permission : legacyScopePermission[permission as PermissionScope];
  if (resolved === "offerings.capture") return user.permissions.includes("offerings.capture") || user.permissions.includes("offerings.manage");
  if (resolved === "offerings.audit.view") return user.permissions.includes("offerings.audit.view") || user.permissions.includes("offerings.view") || user.permissions.includes("offerings.manage");
  if (resolved === "offerings.view") return user.permissions.includes("offerings.audit.view") || user.permissions.includes("offerings.view") || user.permissions.includes("offerings.manage");
  return user.permissions.includes(resolved);
}

export function normalizedPermanentPermissions(values: string[]): Permission[] {
  const normalized = new Set(values as Permission[]);
  if (normalized.delete("offerings.view")) normalized.add("offerings.audit.view");
  if (normalized.delete("offerings.manage")) {
    normalized.add("offerings.capture");
    normalized.add("offerings.audit.view");
  }
  return [...normalized];
}

export function assertAccess(user: User, scope: PermissionScope): void {
  if (!canAccess(user, scope)) {
    throw new Error(`User ${user.email} cannot access ${scope}`);
  }
}

export function assignmentGrantsPermission(kind: "PRIMARY" | "BACKUP", servicePermissions: string[], permission: Permission) {
  if (permission.startsWith("offerings.")) return false;
  return kind === "BACKUP" ? permission === "services.view" : servicePermissions.includes(permission);
}

export function servicePermissionWindowIsOpen(status: string, serviceAt: Date, now = new Date()) {
  return status === "PUBLISHED" && serviceAt.getTime() + 12 * 60 * 60 * 1000 > now.getTime();
}

export async function hasServicePermission(user: User, permission: Permission, servicePlanId: string) {
  if (canAccess(user, permission)) return true;
  if (!user.personId) return false;
  const assignment = await prisma.serviceAssignment.findFirst({
    where: {
      churchId: user.churchId, personId: user.personId, status: "CONFIRMED",
      serviceSlot: { servicePlanId, servicePlan: { status: "PUBLISHED", serviceAt: { gt: new Date(Date.now() - 12 * 60 * 60 * 1000) } } }
    },
    include: { serviceSlot: { include: { ministryRole: true, servicePlan: true } } },
    orderBy: { createdAt: "desc" }
  });
  if (!assignment) return false;
  if (!servicePermissionWindowIsOpen(assignment.serviceSlot.servicePlan.status, assignment.serviceSlot.servicePlan.serviceAt)) return false;
  return assignmentGrantsPermission(assignment.kind, stringList(assignment.serviceSlot.ministryRole.servicePermissions), permission);
}
