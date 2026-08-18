import { describe, expect, it } from "vitest";
import { createManualCheckInCode, normalizeManualCheckInCode } from "@/lib/manual-check-in-code";

describe("manual check-in codes", () => {
  it("normalizes pasted and typed codes", () => {
    expect(normalizeManualCheckInCode(" ab3d k7m2 ")).toBe("AB3D-K7M2");
    expect(normalizeManualCheckInCode("ab3d-k7m2-extra")).toBe("AB3D-K7M2");
  });

  it("creates an eight-character readable code", () => {
    expect(createManualCheckInCode(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]))).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });
});
