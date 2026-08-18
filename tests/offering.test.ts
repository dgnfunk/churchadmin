import { describe, expect, it } from "vitest";
import { currencyFractionDigits, formatMoneyMinor, minorToDecimal, parseMoneyToMinor } from "@/lib/offering-money";
import { buildOfferingReport, capturerCanViewOffering, offeringCurrentMonthBounds } from "@/lib/offering-reporting-core";
import { ministryRolePresets } from "@/lib/ministry-role-presets";

describe("offering money", () => {
  it("converts currencies using their exact minor units", () => {
    expect(currencyFractionDigits("MXN")).toBe(2);
    expect(parseMoneyToMinor("1234.56", "MXN")).toBe(123456n);
    expect(parseMoneyToMinor("1234,5", "MXN")).toBe(123450n);
    expect(minorToDecimal(123456n, "MXN")).toBe("1234.56");
    expect(formatMoneyMinor(123456n, "MXN")).toContain("1,234.56");
  });

  it("supports zero-decimal and three-decimal currencies", () => {
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(parseMoneyToMinor("4500", "JPY")).toBe(4500n);
    expect(parseMoneyToMinor("4500.1", "JPY")).toBeNull();
    expect(currencyFractionDigits("KWD")).toBe(3);
    expect(parseMoneyToMinor("12.345", "KWD")).toBe(12345n);
    expect(parseMoneyToMinor("12.3456", "KWD")).toBeNull();
  });
});

describe("offering reporting", () => {
  const records = [
    { id: "previous", title: "Anterior", serviceAt: new Date("2026-03-01T16:00:00Z"), amountMinor: 10000n },
    { id: "captured", title: "Servicio uno", serviceAt: new Date("2026-04-05T16:00:00Z"), amountMinor: 20000n },
    { id: "zero", title: "Servicio en cero", serviceAt: new Date("2026-04-12T16:00:00Z"), amountMinor: 0n },
    { id: "missing", title: "Sin captura", serviceAt: new Date("2026-05-03T16:00:00Z") },
    { id: "peak", title: "Servicio mayor", serviceAt: new Date("2026-06-07T16:00:00Z"), amountMinor: 30000n },
  ];

  it("keeps confirmed zero separate from missing capture", () => {
    const report = buildOfferingReport(records, "quarter", "2026-04-15", "America/Monterrey");
    expect(report.summary).toMatchObject({
      totalAmountMinor: "50000",
      averageAmountMinor: "16667",
      peakAmountMinor: "30000",
      capturedCount: 3,
      pendingCount: 1,
      changePercent: 400,
    });
    expect(report.points.map((point) => point.label)).toHaveLength(3);
  });

  it("uses the church time zone at month boundaries", () => {
    const boundary = [
      { id: "march-local", title: "Marzo", serviceAt: new Date("2026-04-01T03:00:00Z"), amountMinor: 100n },
      { id: "april-local", title: "Abril", serviceAt: new Date("2026-04-01T08:00:00Z"), amountMinor: 200n },
    ];
    const march = buildOfferingReport(boundary, "month", "2026-03-15", "America/Monterrey");
    const april = buildOfferingReport(boundary, "month", "2026-04-15", "America/Monterrey");
    expect(march.summary.totalAmountMinor).toBe("100");
    expect(april.summary.totalAmountMinor).toBe("200");
  });

  it("creates six and twelve calendar buckets for semester and year", () => {
    expect(buildOfferingReport(records, "semester", "2026-08-01", "America/Monterrey").points).toHaveLength(6);
    expect(buildOfferingReport(records, "year", "2026-08-01", "America/Monterrey").points).toHaveLength(12);
  });

  it("builds the current capture month in the church time zone", () => {
    const bounds = offeringCurrentMonthBounds(new Date("2026-08-18T18:00:00Z"), "America/Monterrey");
    expect(bounds.start.toISOString()).toBe("2026-08-01T06:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-01T06:00:00.000Z");
  });

  it("shows a capturer only their own records from the current month", () => {
    const now = new Date("2026-08-18T18:00:00Z");
    expect(capturerCanViewOffering("user-1", new Date("2026-08-01T06:00:00Z"), "user-1", now, "America/Monterrey")).toBe(true);
    expect(capturerCanViewOffering("user-2", new Date("2026-08-10T16:00:00Z"), "user-1", now, "America/Monterrey")).toBe(false);
    expect(capturerCanViewOffering("user-1", new Date("2026-07-31T23:00:00Z"), "user-1", now, "America/Monterrey")).toBe(false);
  });
});

describe("offering ministry presets", () => {
  it("keeps capture and audit in separate permanent roles", () => {
    expect(ministryRolePresets.treasury.basePermissions).toEqual(["offerings.capture"]);
    expect(ministryRolePresets["offering-auditor"].basePermissions).toEqual(["offerings.audit.view"]);
  });
});
