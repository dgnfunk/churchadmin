import { describe, expect, it } from "vitest";
import { paginateServiceItem, propresenterText } from "@/lib/slide-pagination";
import { servicePlans, theme } from "@/lib/sample-data";

describe("slide pagination", () => {
  it("honors manual breaks and automatic song limits", () => {
    const item = { ...servicePlans[0].items[0], body: "Line one\nLine two\nLine three\n---\nFinal line" };
    const result = paginateServiceItem(item, theme);
    expect(result.slides).toEqual([["Line one", "Line two"], ["Line three"], ["Final line"]]);
  });

  it("uses the same pages in ProPresenter text", () => {
    const item = { ...servicePlans[0].items[1], body: "First line\nSecond line\n---\nThird line" };
    expect(propresenterText(item, theme)).toContain("First line\nSecond line\n//\nPsalm Reading\nThird line");
  });
});
