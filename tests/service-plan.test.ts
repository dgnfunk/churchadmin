import { describe, expect, it } from "vitest";
import { duplicateServicePlan, itemsForExport, orderedItems } from "@/lib/service-plan";
import { servicePlans } from "@/lib/sample-data";

describe("service plans", () => {
  it("returns ordered service items", () => {
    const items = orderedItems(servicePlans[0]);

    expect(items.map((item) => item.sortOrder)).toEqual([1, 2, 3, 4, 5]);
  });

  it("filters items by export tag", () => {
    expect(itemsForExport(servicePlans[0], "SLIDE").map((item) => item.title)).toEqual([
      "Opening Song",
      "Psalm Reading",
      "Community Lunch"
    ]);
  });

  it("duplicates a plan and rewrites item ownership", () => {
    const copy = duplicateServicePlan(servicePlans[0], "service-copy", "2026-07-05T10:00:00.000Z");

    expect(copy.id).toBe("service-copy");
    expect(copy.items.every((item) => item.servicePlanId === "service-copy")).toBe(true);
  });
});
