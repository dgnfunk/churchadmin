import { describe, expect, it } from "vitest";
import { hashAttendeeToken } from "@/lib/attendee-auth";

describe("attendee session tokens", () => {
  it("stores a deterministic HMAC rather than the bearer token", () => {
    const token = "private-browser-token";
    const hash = hashAttendeeToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashAttendeeToken(token)).toBe(hash);
    expect(hashAttendeeToken(`${token}-other`)).not.toBe(hash);
  });
});
