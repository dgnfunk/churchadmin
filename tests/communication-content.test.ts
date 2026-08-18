import { afterEach, describe, expect, it } from "vitest";
import { decryptCredentials, encryptCredentials } from "@/lib/credential-crypto";
import { communicationTemplateVariables, metaTemplateBody, renderCommunicationTemplate, youtubeVideoId } from "@/lib/communication-content";

const originalKey = process.env.SOCIAL_CREDENTIALS_KEY;
afterEach(() => { process.env.SOCIAL_CREDENTIALS_KEY = originalKey; });

describe("communication content", () => {
  it("accepts canonical, short, and Shorts YouTube links", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-YouTube links and unknown variables", () => {
    expect(() => youtubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toThrow();
    expect(() => renderCommunicationTemplate("{{unknown.value}}", { church: { name: "Iglesia" }, youtube: { title: "Video", channel: "Canal", url: "https://youtu.be/dQw4w9WgXcQ" } })).toThrow("no está permitida");
  });

  it("renders local variables and converts them to Meta positions", () => {
    const template = "Hola {{person.firstName}}, mira {{youtube.title}} en {{youtube.url}}";
    expect(communicationTemplateVariables(template)).toEqual(["person.firstName", "youtube.title", "youtube.url"]);
    expect(metaTemplateBody(template)).toBe("Hola {{1}}, mira {{2}} en {{3}}");
    expect(renderCommunicationTemplate(template, { person: { firstName: "Ana" }, church: { name: "Iglesia" }, youtube: { title: "Domingo", channel: "Canal", url: "https://youtu.be/dQw4w9WgXcQ" } })).toContain("Hola Ana");
  });
});

describe("credential encryption", () => {
  it("encrypts authenticated credentials without exposing plaintext", () => {
    process.env.SOCIAL_CREDENTIALS_KEY = "test-key-with-at-least-thirty-two-characters";
    const encrypted = encryptCredentials({ accessToken: "secret-token" });
    expect(encrypted).not.toContain("secret-token");
    expect(decryptCredentials(encrypted)).toEqual({ accessToken: "secret-token" });
  });

  it("rejects tampered credentials", () => {
    process.env.SOCIAL_CREDENTIALS_KEY = "test-key-with-at-least-thirty-two-characters";
    const encrypted = encryptCredentials({ accessToken: "secret-token" });
    expect(() => decryptCredentials(`${encrypted.slice(0, -1)}A`)).toThrow();
  });
});
