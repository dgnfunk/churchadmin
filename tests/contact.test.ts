import { describe, expect, it } from "vitest";
import { normalizeContact, validPhoneRegion } from "@/lib/contact";

describe("contact normalization", () => {
  it("normalizes email case and whitespace", () => {
    expect(normalizeContact("  ANA@Example.COM ", "MX")).toMatchObject({ kind: "email", value: "ana@example.com" });
  });

  it("matches formatted and international Mexican phone numbers", () => {
    const local = normalizeContact("81 1234 5678", "MX");
    const international = normalizeContact("+52 81 1234 5678", "MX");
    expect(local?.value).toBe("528112345678");
    expect(international?.value).toBe(local?.value);
  });

  it("rejects unusable contacts and falls back to Mexico", () => {
    expect(normalizeContact("123", "MX")).toBeNull();
    expect(validPhoneRegion("invalid")).toBe("MX");
  });
});
