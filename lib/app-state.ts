import type { ServicePlan, SlideTheme, ThemeSettings, User } from "@/lib/domain";
import type { AppState } from "@/lib/app-state-shared";
import { prisma } from "@/lib/prisma";
import { serializeServicePlan, servicePlanInclude } from "@/lib/service-serialization";
import { canAccess } from "@/lib/permissions";

export async function getInitialAppState(churchId?: string, user?: User | null): Promise<AppState> {
  const serviceWhere = !user ? { id: "__public-no-services__" } : canAccess(user, "services.view") ? {} : user.personId ? { serviceSlots: { some: { assignments: { some: { personId: user.personId, status: "CONFIRMED" as const } } } } } : { id: "__member-no-services__" };
  const church = await prisma.church.findUnique({
      where: churchId ? { id: churchId } : { slug: process.env.CHURCH_SLUG ?? "grace-community" },
      include: {
        theme: true,
        slideThemes: { include: { backgroundAsset: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] },
        servicePlans: {
          where: serviceWhere,
          include: servicePlanInclude,
          orderBy: { serviceAt: "desc" }
        }
      }
    });

  if (!church) throw new Error("Church configuration was not found. Run the database seed before using the app.");
  if (!church.theme) throw new Error("Theme settings were not found for this church.");

    const servicePlans: ServicePlan[] = church.servicePlans.map(serializeServicePlan);
    const slideThemes: SlideTheme[] = church.slideThemes.map((slideTheme) => ({
      id: slideTheme.id,
      churchId: slideTheme.churchId,
      name: slideTheme.name,
      isDefault: slideTheme.isDefault,
      backgroundType: slideTheme.backgroundType,
      backgroundColor: slideTheme.backgroundColor,
      backgroundAssetId: slideTheme.backgroundAssetId ?? undefined,
      backgroundAsset: slideTheme.backgroundAsset ? {
        id: slideTheme.backgroundAsset.id,
        churchId: slideTheme.backgroundAsset.churchId,
        serviceItemId: slideTheme.backgroundAsset.serviceItemId ?? undefined,
        role: slideTheme.backgroundAsset.role,
        originalName: slideTheme.backgroundAsset.originalName,
        mimeType: slideTheme.backgroundAsset.mimeType,
        sizeBytes: Number(slideTheme.backgroundAsset.sizeBytes),
        checksum: slideTheme.backgroundAsset.checksum
      } : undefined,
      overlayColor: slideTheme.overlayColor,
      overlayOpacity: slideTheme.overlayOpacity,
      textColor: slideTheme.textColor,
      accentColor: slideTheme.accentColor,
      layout: slideTheme.layout,
      fontFamily: slideTheme.fontFamily, titleFontSize: slideTheme.titleFontSize, bodyFontSize: slideTheme.bodyFontSize,
      fontWeight: slideTheme.fontWeight, safeMargin: slideTheme.safeMargin, logoPlacement: slideTheme.logoPlacement
    }));

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
      servicePlans,
      slideThemes,
      activeServicePlanId: servicePlans[0]?.id ?? ""
    };
}
