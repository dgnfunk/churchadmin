import type { ServiceItem, ServicePlan, SlideTheme } from "@/lib/domain";

export const slideResolutionPresets = [
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
  { label: "1440p", width: 2560, height: 1440 },
  { label: "4K", width: 3840, height: 2160 }
] as const;

export function validateSlideResolution(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("Resolution must use whole pixels.");
  if (width < 640 || width > 3840 || height < 360 || height > 2160) {
    throw new Error("Resolution must be between 640x360 and 3840x2160.");
  }
  if (width * 9 !== height * 16) throw new Error("Slide resolution must use a 16:9 aspect ratio.");
  return { width, height };
}

export function resolveSlideTheme(item: Pick<ServiceItem, "slideThemeId">, plan: Pick<ServicePlan, "slideThemeId">, themes: SlideTheme[]) {
  return themes.find((theme) => theme.id === item.slideThemeId)
    ?? themes.find((theme) => theme.id === plan.slideThemeId)
    ?? themes.find((theme) => theme.isDefault)
    ?? themes[0];
}

export function slideThemeBackgroundStyle(theme: SlideTheme): Record<string, string> {
  const image = theme.backgroundType === "IMAGE" && theme.backgroundAssetId
    ? `url(/api/media/${theme.backgroundAssetId}?disposition=inline)`
    : "none";
  return {
    backgroundColor: theme.backgroundColor,
    backgroundImage: image,
    backgroundPosition: "center",
    backgroundSize: "cover",
    color: theme.textColor
  };
}
