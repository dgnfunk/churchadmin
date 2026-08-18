import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Permission, PermissionScope, User } from "@/lib/domain";
import { verifyPassword } from "@/lib/password";
import { canAccess, hasServicePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { stringList } from "@/lib/database-compat";

const sessionCookieName = "churchadmin_session";
const sessionDays = 7;

function serializeUser(user: {
  id: string;
  churchId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  personId: string | null;
  mustChangePassword: boolean;
  person: { ministryMemberships: Array<{ ministryRole: { basePermissions: unknown } }> } | null;
  isActive: boolean;
}): User {
  return {
    id: user.id,
    churchId: user.churchId,
    name: user.name,
    email: user.email,
    role: user.role,
    personId: user.personId ?? undefined,
    permissions: [...new Set([
      ...(user.role === "MEMBER" ? ["schedule.view.own", "schedule.propose"] : []),
      ...(user.person?.ministryMemberships.flatMap((membership) => stringList(membership.ministryRole.basePermissions)) ?? [])
    ])] as Permission[],
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { person: { include: { ministryMemberships: { where: { isActive: true }, include: { ministryRole: true } } } } } } }
  });

  if (!session || !session.user.isActive || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    }
    return null;
  }

  return serializeUser(session.user);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireScope(scope: PermissionScope) {
  const user = await requireUser();
  if (!canAccess(user, scope)) {
    redirect("/");
  }

  return user;
}

export async function requirePermission(permission: Permission, options?: { servicePlanId?: string }) {
  const user = await requireUser();
  const allowed = options?.servicePlanId
    ? await hasServicePermission(user, permission, options.servicePlanId)
    : canAccess(user, permission);
  if (!allowed) redirect("/");
  return user;
}

export async function createSessionForLogin(email: string, password: string) {
  const church = await prisma.church.findUniqueOrThrow({
    where: { slug: process.env.CHURCH_SLUG ?? "grace-community" },
    select: { id: true }
  });
  const user = await prisma.user.findUnique({
    where: {
      churchId_email: {
        churchId: church.id,
        email: email.trim().toLowerCase()
      }
    }
  });

  if (!user?.isActive || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + sessionDays);

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });

  const hydrated = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { person: { include: { ministryMemberships: { where: { isActive: true }, include: { ministryRole: true } } } } }
  });
  return serializeUser(hydrated);
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(sessionCookieName);
}
