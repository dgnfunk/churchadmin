import { describe, expect, it } from "vitest";
import { canAccess } from "@/lib/permissions";
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
});
