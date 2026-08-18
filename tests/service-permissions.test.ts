import { describe, expect, it } from "vitest";
import { assignmentGrantsPermission, servicePermissionWindowIsOpen } from "@/lib/permissions";

describe("temporary service permissions", () => {
  it("grants configured permissions to a primary assignment", () => {
    expect(assignmentGrantsPermission("PRIMARY", ["services.view", "services.content.edit"], "services.content.edit")).toBe(true);
    expect(assignmentGrantsPermission("PRIMARY", ["services.view"], "attendance.analytics.view")).toBe(false);
  });

  it("limits a backup to read-only service access", () => {
    expect(assignmentGrantsPermission("BACKUP", ["media.manage"], "services.view")).toBe(true);
    expect(assignmentGrantsPermission("BACKUP", ["media.manage"], "media.manage")).toBe(false);
  });

  it("does not grant offering permissions through a service assignment", () => {
    expect(assignmentGrantsPermission("PRIMARY", ["offerings.capture"], "offerings.capture")).toBe(false);
    expect(assignmentGrantsPermission("BACKUP", ["offerings.audit.view"], "offerings.audit.view")).toBe(false);
  });

  it("closes permissions after completion or twelve hours", () => {
    const now = new Date("2026-08-05T12:00:00Z");
    expect(servicePermissionWindowIsOpen("PUBLISHED", new Date("2026-08-05T01:00:01Z"), now)).toBe(true);
    expect(servicePermissionWindowIsOpen("PUBLISHED", new Date("2026-08-05T00:00:00Z"), now)).toBe(false);
    expect(servicePermissionWindowIsOpen("COMPLETED", new Date("2026-08-05T10:00:00Z"), now)).toBe(false);
  });
});
