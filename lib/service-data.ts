import type { Church, ServicePlan, SlideTheme, ThemeSettings } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { serializeServicePlan, servicePlanInclude } from "@/lib/service-serialization";

export interface ServiceExportData {
  church: Church;
  theme: ThemeSettings;
  plan: ServicePlan;
  slideThemes: SlideTheme[];
}

export async function getServiceExportData(servicePlanId: string | undefined, churchId: string): Promise<ServiceExportData> {
    const church = await prisma.church.findUnique({
      where: { id: churchId },
      include: {
        theme: true,
        slideThemes: { include: { backgroundAsset: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] },
        servicePlans: {
          where: servicePlanId ? { id: servicePlanId } : undefined,
          include: servicePlanInclude,
          orderBy: { serviceAt: "desc" },
          take: 1
        }
      }
    });

    const plan = church?.servicePlans[0];

    if (!church || !church.theme || !plan) throw new Error("Service export data was not found.");

    return {
      church: {
        id: church.id,
        name: church.name,
        slug: church.slug,
        logoUrl: church.logoUrl ?? undefined,
        logoAssetId: church.logoAssetId ?? undefined,
        timeZone: church.timeZone
        ,defaultPhoneRegion: church.defaultPhoneRegion
      },
      theme: {
        churchId: church.theme.churchId,
        primaryColor: church.theme.primaryColor,
        accentColor: church.theme.accentColor,
        mode: church.theme.mode === "dark" ? "dark" : "light",
        logoUrl: church.theme.logoUrl ?? undefined,
        headingStyle: ["classic", "modern", "serif"].includes(church.theme.headingStyle)
          ? (church.theme.headingStyle as ThemeSettings["headingStyle"])
          : "classic",
        exportHeader: church.theme.exportHeader === "minimal" ? "minimal" : "branded",
        slideTemplate: church.theme.slideTemplate === "lower-third" ? "lower-third" : "centered"
        ,songLinesPerSlide: church.theme.songLinesPerSlide
        ,textLinesPerSlide: church.theme.textLinesPerSlide
        ,maxCharactersPerSlide: church.theme.maxCharactersPerSlide
        ,defaultSlideWidth: church.theme.defaultSlideWidth
        ,defaultSlideHeight: church.theme.defaultSlideHeight
      },
      plan: serializeServicePlan(plan),
      slideThemes: church.slideThemes.map((slideTheme) => ({
        id: slideTheme.id, churchId: slideTheme.churchId, name: slideTheme.name, isDefault: slideTheme.isDefault,
        backgroundType: slideTheme.backgroundType, backgroundColor: slideTheme.backgroundColor,
        backgroundAssetId: slideTheme.backgroundAssetId ?? undefined,
        backgroundAsset: slideTheme.backgroundAsset ? {
          id: slideTheme.backgroundAsset.id, churchId: slideTheme.backgroundAsset.churchId,
          serviceItemId: slideTheme.backgroundAsset.serviceItemId ?? undefined, role: slideTheme.backgroundAsset.role,
          originalName: slideTheme.backgroundAsset.originalName, mimeType: slideTheme.backgroundAsset.mimeType,
          sizeBytes: Number(slideTheme.backgroundAsset.sizeBytes), checksum: slideTheme.backgroundAsset.checksum
        } : undefined,
        overlayColor: slideTheme.overlayColor, overlayOpacity: slideTheme.overlayOpacity,
        textColor: slideTheme.textColor, accentColor: slideTheme.accentColor, layout: slideTheme.layout,
        fontFamily: slideTheme.fontFamily, titleFontSize: slideTheme.titleFontSize, bodyFontSize: slideTheme.bodyFontSize,
        fontWeight: slideTheme.fontWeight, safeMargin: slideTheme.safeMargin, logoPlacement: slideTheme.logoPlacement
      }))
    };
}
