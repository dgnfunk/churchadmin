import { describe, expect, it } from "vitest";
import { canAccess, normalizedPermanentPermissions } from "@/lib/permissions";
import type { User } from "@/lib/domain";

describe("permissions", () => {
  it("allows admins to access every module", () => {
    const user: User = {
      id: "u1",
      churchId: "c1",
      name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
      permissions: [], isActive: true, mustChangePassword: false
    };

    expect(canAccess(user, "theme")).toBe(true);
    expect(canAccess(user, "users")).toBe(true);
  });

  it("limits members to permissions derived from ministry roles", () => {
    const user: User = {
      id: "u2",
      churchId: "c1",
      name: "Volunteer",
      email: "volunteer@example.com",
      role: "MEMBER",
      permissions: ["attendance.checkin.manual"], isActive: true, mustChangePassword: false
    };

    expect(canAccess(user, "attendance.checkin.manual")).toBe(true);
    expect(canAccess(user, "attendance.analytics.view")).toBe(false);
    expect(canAccess(user, "theme")).toBe(false);
  });

  it("separates offering capture from read-only auditing", () => {
    const treasurer: User = { id: "u3", churchId: "c1", name: "Treasurer", email: "treasurer@example.com", role: "MEMBER", permissions: ["offerings.capture"], isActive: true, mustChangePassword: false };
    const auditor: User = { ...treasurer, id: "u4", name: "Auditor", email: "auditor@example.com", permissions: ["offerings.audit.view"] };
    expect(canAccess(treasurer, "offerings.capture")).toBe(true);
    expect(canAccess(treasurer, "offerings.audit.view")).toBe(false);
    expect(canAccess(auditor, "offerings.capture")).toBe(false);
    expect(canAccess(auditor, "offerings.audit.view")).toBe(true);
  });

  it("keeps legacy offering permissions compatible and normalizes them for editing", () => {
    const legacy: User = { id: "u5", churchId: "c1", name: "Legacy", email: "legacy@example.com", role: "MEMBER", permissions: ["offerings.manage"], isActive: true, mustChangePassword: false };
    expect(canAccess(legacy, "offerings.capture")).toBe(true);
    expect(canAccess(legacy, "offerings.audit.view")).toBe(true);
    expect(normalizedPermanentPermissions(["offerings.manage"])).toEqual(expect.arrayContaining(["offerings.capture", "offerings.audit.view"]));
  });
});
