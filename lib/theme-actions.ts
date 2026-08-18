"use server";

import { revalidatePath } from "next/cache";
import type { SlideBackgroundType, SlideTheme, SlideThemeLayout, ThemeMode } from "@/lib/domain";
import { requireScope } from "@/lib/auth";
import { moveMediaToTrash } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { validateSlideResolution } from "@/lib/slide-themes";
import { equalsText } from "@/lib/database-compat";

const hexPattern = /^#[0-9a-fA-F]{6}$/;

function color(value: string, fallback: string) {
  return hexPattern.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function serializeSlideTheme(theme: {
  id: string; churchId: string; name: string; isDefault: boolean; backgroundType: SlideBackgroundType;
  backgroundColor: string; backgroundAssetId: string | null; overlayColor: string; overlayOpacity: number;
  textColor: string; accentColor: string; layout: SlideThemeLayout; fontFamily: "INTER" | "ARIAL" | "GEORGIA";
  titleFontSize: number; bodyFontSize: number; fontWeight: number; safeMargin: number; logoPlacement: "NONE" | "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT";
  backgroundAsset: null | { id: string; churchId: string; serviceItemId: string | null; role: "PRIMARY" | "BACKGROUND" | "AUDIO" | "REFERENCE"; originalName: string; mimeType: string; sizeBytes: bigint; checksum: string };
}): SlideTheme {
  return {
    id: theme.id, churchId: theme.churchId, name: theme.name, isDefault: theme.isDefault,
    backgroundType: theme.backgroundType, backgroundColor: theme.backgroundColor,
    backgroundAssetId: theme.backgroundAssetId ?? undefined,
    backgroundAsset: theme.backgroundAsset ? {
      id: theme.backgroundAsset.id, churchId: theme.backgroundAsset.churchId,
      serviceItemId: theme.backgroundAsset.serviceItemId ?? undefined, role: theme.backgroundAsset.role,
      originalName: theme.backgroundAsset.originalName, mimeType: theme.backgroundAsset.mimeType,
      sizeBytes: Number(theme.backgroundAsset.sizeBytes), checksum: theme.backgroundAsset.checksum
    } : undefined,
    overlayColor: theme.overlayColor, overlayOpacity: theme.overlayOpacity,
    textColor: theme.textColor, accentColor: theme.accentColor, layout: theme.layout,
    fontFamily: theme.fontFamily, titleFontSize: theme.titleFontSize, bodyFontSize: theme.bodyFontSize,
    fontWeight: theme.fontWeight, safeMargin: theme.safeMargin, logoPlacement: theme.logoPlacement
  };
}

export async function listSlideThemes(): Promise<SlideTheme[]> {
  const user = await requireScope("theme");
  const themes = await prisma.slideTheme.findMany({
    where: { churchId: user.churchId }, include: { backgroundAsset: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });
  return themes.map(serializeSlideTheme);
}

interface SaveThemeSettingsInput {
  churchId: string;
  churchName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  mode: ThemeMode;
  songLinesPerSlide: number;
  textLinesPerSlide: number;
  maxCharactersPerSlide: number;
  defaultSlideWidth: number;
  defaultSlideHeight: number;
  timeZone: string;
  defaultPhoneRegion: string;
}

export async function saveThemeSettings(input: SaveThemeSettingsInput) {
  const user = await requireScope("theme");
  const churchName = input.churchName.trim();
  if (churchName.length < 2 || churchName.length > 120) throw new Error("El nombre de la iglesia debe tener entre 2 y 120 caracteres.");
  const logoUrl = input.logoUrl?.trim() || null;
  if (logoUrl) { try { const parsed = new URL(logoUrl); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch { throw new Error("La dirección del logotipo debe ser una URL HTTP o HTTPS válida."); } }
  if (!hexPattern.test(input.primaryColor) || !hexPattern.test(input.accentColor)) throw new Error("Los colores deben usar un código hexadecimal válido.");
  if (!['light', 'dark'].includes(input.mode)) throw new Error("El modo de apariencia no es válido.");
  if (!Number.isInteger(input.songLinesPerSlide) || input.songLinesPerSlide < 1 || input.songLinesPerSlide > 8) throw new Error("Las líneas de canciones deben estar entre 1 y 8.");
  if (!Number.isInteger(input.textLinesPerSlide) || input.textLinesPerSlide < 1 || input.textLinesPerSlide > 10) throw new Error("Las líneas de texto deben estar entre 1 y 10.");
  if (!Number.isInteger(input.maxCharactersPerSlide) || input.maxCharactersPerSlide < 40 || input.maxCharactersPerSlide > 500) throw new Error("El máximo de caracteres debe estar entre 40 y 500.");
  try { new Intl.DateTimeFormat("es-MX", { timeZone: input.timeZone }).format(); } catch { throw new Error("Selecciona una zona horaria válida."); }
  if (!/^[A-Z]{2}$/.test(input.defaultPhoneRegion)) throw new Error("Selecciona una región telefónica válida.");
  const resolution = validateSlideResolution(input.defaultSlideWidth, input.defaultSlideHeight);

  await prisma.$transaction([
    prisma.church.update({ where: { id: user.churchId }, data: {
      name: churchName, logoUrl, timeZone: input.timeZone || "America/Monterrey",
      defaultPhoneRegion: /^[A-Z]{2}$/.test(input.defaultPhoneRegion) ? input.defaultPhoneRegion : "MX"
    } }),
    prisma.themeSettings.upsert({
      where: { churchId: user.churchId },
      update: {
        primaryColor: color(input.primaryColor, "#0f766e"), accentColor: color(input.accentColor, "#d69e2e"),
        mode: input.mode, logoUrl, songLinesPerSlide: Math.min(8, Math.max(1, input.songLinesPerSlide)),
        textLinesPerSlide: Math.min(10, Math.max(1, input.textLinesPerSlide)),
        maxCharactersPerSlide: Math.min(500, Math.max(40, input.maxCharactersPerSlide)),
        defaultSlideWidth: resolution.width, defaultSlideHeight: resolution.height
      },
      create: {
        churchId: user.churchId, primaryColor: color(input.primaryColor, "#0f766e"),
        accentColor: color(input.accentColor, "#d69e2e"), mode: input.mode, logoUrl,
        songLinesPerSlide: Math.min(8, Math.max(1, input.songLinesPerSlide)),
        textLinesPerSlide: Math.min(10, Math.max(1, input.textLinesPerSlide)),
        maxCharactersPerSlide: Math.min(500, Math.max(40, input.maxCharactersPerSlide)),
        defaultSlideWidth: resolution.width, defaultSlideHeight: resolution.height
      }
    })
  ]);
  revalidatePath("/", "layout");
}

export async function saveSlideTheme(input: {
  id?: string; name: string; isDefault: boolean; backgroundType: SlideBackgroundType;
  backgroundColor: string; overlayColor: string; overlayOpacity: number;
  textColor: string; accentColor: string; layout: SlideThemeLayout;
  fontFamily?: "INTER" | "ARIAL" | "GEORGIA"; titleFontSize?: number; bodyFontSize?: number; fontWeight?: number; safeMargin?: number;
  logoPlacement?: "NONE" | "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT";
}) {
  const user = await requireScope("theme");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) throw new Error("El nombre del tema debe tener entre 2 y 100 caracteres.");
  if (![input.backgroundColor, input.overlayColor, input.textColor, input.accentColor].every((value) => hexPattern.test(value))) throw new Error("Todos los colores del tema deben usar formato hexadecimal.");
  if (!['COLOR', 'IMAGE'].includes(input.backgroundType) || !['CENTERED', 'LOWER_THIRD'].includes(input.layout)) throw new Error("El tipo de fondo o la distribución no son válidos.");
  const numericValues = [input.overlayOpacity, input.titleFontSize ?? 82, input.bodyFontSize ?? 46, input.fontWeight ?? 700, input.safeMargin ?? 96];
  if (numericValues.some((value) => !Number.isFinite(value))) throw new Error("Los valores numéricos del tema no son válidos.");
  const duplicate = await prisma.slideTheme.findFirst({ where: { churchId: user.churchId, name: equalsText(name), ...(input.id ? { id: { not: input.id } } : {}) }, select: { id: true } });
  if (duplicate) throw new Error("Ya existe un tema de diapositivas con ese nombre.");
  const data = {
    name, backgroundType: input.backgroundType,
    backgroundColor: color(input.backgroundColor, "#0f766e"), overlayColor: color(input.overlayColor, "#102421"),
    overlayOpacity: Math.min(90, Math.max(0, Math.round(input.overlayOpacity))),
    textColor: color(input.textColor, "#ffffff"), accentColor: color(input.accentColor, "#d69e2e"), layout: input.layout,
    fontFamily: input.fontFamily ?? "INTER", titleFontSize: Math.min(140, Math.max(36, input.titleFontSize ?? 82)), bodyFontSize: Math.min(90, Math.max(24, input.bodyFontSize ?? 46)),
    fontWeight: Math.min(900, Math.max(300, input.fontWeight ?? 700)), safeMargin: Math.min(200, Math.max(40, input.safeMargin ?? 96)), logoPlacement: input.logoPlacement ?? "TOP_LEFT"
  };

  const saved = await prisma.$transaction(async (tx) => {
    if (input.id) {
      const existing = await tx.slideTheme.findFirst({ where: { id: input.id, churchId: user.churchId } });
      if (!existing) throw new Error("El tema de diapositivas ya no está disponible.");
      if (input.isDefault) await tx.slideTheme.updateMany({ where: { churchId: user.churchId, isDefault: true, id: { not: existing.id } }, data: { isDefault: false } });
      return tx.slideTheme.update({ where: { id: existing.id }, data: { ...data, isDefault: input.isDefault || existing.isDefault }, include: { backgroundAsset: true } });
    }
    if (input.isDefault) await tx.slideTheme.updateMany({ where: { churchId: user.churchId, isDefault: true }, data: { isDefault: false } });
    return tx.slideTheme.create({ data: { ...data, churchId: user.churchId, isDefault: input.isDefault }, include: { backgroundAsset: true } });
  });
  revalidatePath("/", "layout");
  return serializeSlideTheme(saved);
}

export async function duplicateSlideTheme(input: { themeId: string }) {
  const user = await requireScope("theme");
  const source = await prisma.slideTheme.findFirst({ where: { id: input.themeId, churchId: user.churchId } });
  if (!source) throw new Error("El tema de diapositivas ya no está disponible.");
  let name = `${source.name} copia`;
  let suffix = 2;
  while (await prisma.slideTheme.findFirst({ where: { churchId: user.churchId, name } })) name = `${source.name} copia ${suffix++}`;
  const copy = await prisma.slideTheme.create({
    data: {
      churchId: user.churchId, name, isDefault: false, backgroundType: source.backgroundType,
      backgroundColor: source.backgroundColor, backgroundAssetId: source.backgroundAssetId,
      overlayColor: source.overlayColor, overlayOpacity: source.overlayOpacity, textColor: source.textColor,
      accentColor: source.accentColor, layout: source.layout, fontFamily: source.fontFamily,
      titleFontSize: source.titleFontSize, bodyFontSize: source.bodyFontSize, fontWeight: source.fontWeight,
      safeMargin: source.safeMargin, logoPlacement: source.logoPlacement
    }, include: { backgroundAsset: true }
  });
  revalidatePath("/", "layout");
  return serializeSlideTheme(copy);
}

export async function deleteSlideTheme(input: { themeId: string; replacementThemeId?: string }) {
  const user = await requireScope("theme");
  const theme = await prisma.slideTheme.findFirst({
    where: { id: input.themeId, churchId: user.churchId },
    include: { _count: { select: { servicePlans: true, serviceItems: true } } }
  });
  if (!theme) throw new Error("El tema de diapositivas ya no está disponible.");
  if (theme.isDefault) throw new Error("El tema predeterminado no se puede eliminar.");
  const inUse = theme._count.servicePlans + theme._count.serviceItems > 0;
  if (inUse && !input.replacementThemeId) throw new Error("Selecciona un reemplazo antes de eliminar un tema en uso.");
  if (input.replacementThemeId) {
    const replacement = await prisma.slideTheme.findFirst({ where: { id: input.replacementThemeId, churchId: user.churchId } });
    if (!replacement || replacement.id === theme.id) throw new Error("El tema de reemplazo no es válido.");
  }
  await prisma.$transaction(async (tx) => {
    if (input.replacementThemeId) {
      await tx.servicePlan.updateMany({ where: { churchId: user.churchId, slideThemeId: theme.id }, data: { slideThemeId: input.replacementThemeId } });
      await tx.serviceItem.updateMany({ where: { slideThemeId: theme.id, servicePlan: { churchId: user.churchId } }, data: { slideThemeId: input.replacementThemeId } });
    }
    await tx.slideTheme.delete({ where: { id: theme.id } });
  });
  if (theme.backgroundAssetId) {
    const references = await prisma.slideTheme.count({ where: { backgroundAssetId: theme.backgroundAssetId } });
    if (!references) {
      const asset = await prisma.mediaAsset.findUnique({ where: { id: theme.backgroundAssetId } });
      if (asset) { await moveMediaToTrash(asset.storageKey); await prisma.mediaAsset.delete({ where: { id: asset.id } }); }
    }
  }
  revalidatePath("/", "layout");
  return { id: theme.id };
}
