import { describe, expect, it } from "vitest";
import type { ServiceItem, ServicePlan, SlideTheme } from "@/lib/domain";
import { resolveSlideTheme, validateSlideResolution } from "@/lib/slide-themes";

const themes: SlideTheme[] = [
  { id: "default", churchId: "church", name: "Default", isDefault: true, backgroundType: "COLOR", backgroundColor: "#000000", overlayColor: "#000000", overlayOpacity: 30, textColor: "#ffffff", accentColor: "#ffcc00", layout: "CENTERED" },
  { id: "service", churchId: "church", name: "Service", isDefault: false, backgroundType: "COLOR", backgroundColor: "#111111", overlayColor: "#000000", overlayOpacity: 30, textColor: "#ffffff", accentColor: "#ffcc00", layout: "CENTERED" },
  { id: "item", churchId: "church", name: "Item", isDefault: false, backgroundType: "COLOR", backgroundColor: "#222222", overlayColor: "#000000", overlayOpacity: 30, textColor: "#ffffff", accentColor: "#ffcc00", layout: "LOWER_THIRD" }
];

function plan(slideThemeId?: string): ServicePlan {
  return { id: "plan", churchId: "church", title: "Service", serviceAt: new Date().toISOString(), status: "PUBLISHED", slideThemeId, items: [] };
}

function item(slideThemeId?: string): ServiceItem {
  return { id: "item-1", servicePlanId: "plan", type: "SONG", title: "Song", body: "Line", sortOrder: 1, exportTags: ["SLIDE"], mediaAssets: [], slideThemeId };
}

describe("slide themes", () => {
  it("resolves item, service, then church default precedence", () => {
    expect(resolveSlideTheme(item("item"), plan("service"), themes)?.id).toBe("item");
    expect(resolveSlideTheme(item(), plan("service"), themes)?.id).toBe("service");
    expect(resolveSlideTheme(item(), plan(), themes)?.id).toBe("default");
  });

  it("accepts supported 16:9 dimensions", () => {
    expect(validateSlideResolution(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(validateSlideResolution(3840, 2160)).toEqual({ width: 3840, height: 2160 });
  });

  it("rejects invalid aspect ratios and bounds", () => {
    expect(() => validateSlideResolution(1920, 1200)).toThrow(/16:9/);
    expect(() => validateSlideResolution(5120, 2880)).toThrow(/between/);
  });
});
