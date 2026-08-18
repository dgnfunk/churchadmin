import { describe, expect, it } from "vitest";
import { inlineThemeStyle, themeToCssVariables } from "@/lib/theme";
import { theme } from "@/lib/sample-data";

describe("theme helpers", () => {
  it("creates CSS variables from brand settings", () => {
    const variables = themeToCssVariables(theme);

    expect(variables["--church-primary"]).toBe("#0f766e");
    expect(variables["--church-accent"]).toBe("#d69e2e");
  });

  it("serializes variables for root layout style", () => {
    expect(inlineThemeStyle(theme)).toContain("--church-primary: #0f766e");
  });
});
