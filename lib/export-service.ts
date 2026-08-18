import { itemsForExport, orderedItems } from "./service-plan";
import type { Church, ServiceItem, ServicePlan, SlideTheme, ThemeSettings } from "./domain";
import { paginateServiceItem } from "./slide-pagination";
import { mediaFilePath } from "./file-storage";
import { prisma } from "./prisma";
import { resolveSlideTheme, validateSlideResolution } from "./slide-themes";
import { createWriteStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface SlideRenderOptions {
  width: number;
  height: number;
  slideTheme?: SlideTheme;
  backgroundPath?: string;
}

function sanitizeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fallbackSlideTheme(appTheme: ThemeSettings): SlideTheme {
  return {
    id: "fallback", churchId: appTheme.churchId, name: "Church Default", isDefault: true,
    backgroundType: "COLOR", backgroundColor: appTheme.primaryColor, overlayColor: "#102421",
    overlayOpacity: 36, textColor: "#ffffff", accentColor: appTheme.accentColor,
    layout: appTheme.slideTemplate === "lower-third" ? "LOWER_THIRD" : "CENTERED",
    fontFamily: "INTER", titleFontSize: 82, bodyFontSize: 46, fontWeight: 700, safeMargin: 96, logoPlacement: "TOP_LEFT"
  };
}

export async function slideThemeBackgroundPath(theme: SlideTheme | undefined) {
  if (theme?.backgroundType !== "IMAGE" || !theme.backgroundAssetId) return undefined;
  const asset = await prisma.mediaAsset.findUnique({ where: { id: theme.backgroundAssetId }, select: { storageKey: true } }).catch(() => null);
  if (!asset) return undefined;
  const filePath = mediaFilePath(asset.storageKey);
  return await stat(filePath).then(() => filePath).catch(() => undefined);
}

async function churchLogoPath(appChurch: Church) {
  if (!appChurch.logoAssetId) return undefined;
  const asset = await prisma.mediaAsset.findFirst({ where: { id: appChurch.logoAssetId, churchId: appChurch.id }, select: { storageKey: true } });
  return asset ? mediaFilePath(asset.storageKey) : undefined;
}

function logoCoordinates(placement: SlideTheme["logoPlacement"]) {
  if (placement === "TOP_RIGHT") return { x: 1580, y: 120 };
  if (placement === "BOTTOM_LEFT") return { x: 130, y: 860 };
  if (placement === "BOTTOM_RIGHT") return { x: 1580, y: 860 };
  return { x: 130, y: 120 };
}

function slideSvg(item: ServiceItem, lines: string[], index: number, appChurch: Church, options: Required<Pick<SlideRenderOptions, "width" | "height">> & { slideTheme: SlideTheme; hasImage: boolean; logoData?: string }): string {
  const { width, height, slideTheme, hasImage } = options;
  const fontFamily = slideTheme.fontFamily === "GEORGIA" ? "Georgia" : slideTheme.fontFamily === "ARIAL" ? "Arial" : "Inter, Arial";
  const titleFontSize = slideTheme.titleFontSize ?? 82;
  const bodyFontSize = slideTheme.bodyFontSize ?? 46;
  const fontWeight = slideTheme.fontWeight ?? 700;
  const safeMargin = slideTheme.safeMargin ?? 96;
  const logoPlacement = slideTheme.logoPlacement ?? "TOP_LEFT";
  const lowerThird = slideTheme.layout === "LOWER_THIRD";
  const titleY = lowerThird ? 690 : 310;
  const bodyStart = lowerThird ? 780 : 400;
  const bodySpans = lines
    .map((line, lineIndex) => {
      const y = bodyStart + lineIndex * 68;
      return `<text x="960" y="${y}" text-anchor="middle" font-size="${bodyFontSize}" fill="${slideTheme.textColor}" font-family="${fontFamily}">${escapeXml(line)}</text>`;
    })
    .join("");
  const logo = options.logoData && logoPlacement !== "NONE" ? logoCoordinates(logoPlacement) : null;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      ${hasImage ? "" : `<rect width="1920" height="1080" fill="${slideTheme.backgroundColor}"/>`}
      <rect x="${safeMargin}" y="${safeMargin}" width="${1920 - safeMargin * 2}" height="${1080 - safeMargin * 2}" rx="24" fill="${slideTheme.overlayColor}" opacity="${slideTheme.overlayOpacity / 100}"/>
      <circle cx="1660" cy="210" r="130" fill="${slideTheme.accentColor}" opacity="0.28"/>
      ${logo ? `<image href="${options.logoData}" x="${logo.x}" y="${logo.y}" width="210" height="110" preserveAspectRatio="xMinYMid meet"/>` : ""}
      <text x="130" y="150" font-size="34" fill="${slideTheme.textColor}" opacity="0.86" font-family="Inter, Arial">${escapeXml(appChurch.name)}</text>
      <text x="130" y="250" font-size="34" fill="${slideTheme.accentColor}" font-family="Inter, Arial">${String(index + 1).padStart(2, "0")}</text>
      ${item.type === "SONG" ? "" : `<text x="960" y="${titleY}" text-anchor="middle" font-size="${titleFontSize}" font-weight="${fontWeight}" fill="${slideTheme.textColor}" font-family="${fontFamily}">${escapeXml(item.title)}</text>`}
      ${bodySpans}
    </svg>
  `;
}

export async function buildSlideZipToFile(
  plan: ServicePlan,
  appChurch: Church,
  appTheme: ThemeSettings,
  destination: string,
  slideThemes: SlideTheme[] = [],
  resolution = { width: 1920, height: 1080 }
): Promise<void> {
  const slideItems = itemsForExport(plan, "SLIDE");
  validateSlideResolution(resolution.width, resolution.height);
  const archiverModule = await import("archiver") as unknown as {
    ZipArchive: new (options: { zlib: { level: number } }) => import("archiver").Archiver;
  };
  const output = createWriteStream(destination, { flags: "wx" });
  const archive = new archiverModule.ZipArchive({ zlib: { level: 6 } });
  const completed = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(output);

  for (const [index, item] of slideItems.entries()) {
    const slideTheme = resolveSlideTheme(item, plan, slideThemes) ?? fallbackSlideTheme(appTheme);
    const backgroundPath = await slideThemeBackgroundPath(slideTheme);
    const { slides } = paginateServiceItem(item, appTheme);
    for (const [pageIndex, lines] of slides.entries()) {
      const png = await buildSlidePng(item, lines, index, appChurch, appTheme, { ...resolution, slideTheme, backgroundPath });
      archive.append(png, { name: `${String(index + 1).padStart(2, "0")}-${sanitizeFilename(item.title)}-${String(pageIndex + 1).padStart(3, "0")}.png` });
    }
  }
  await archive.finalize();
  await completed;
}

export async function buildSlidePng(
  item: ServiceItem,
  lines: string[],
  index: number,
  appChurch: Church,
  appTheme: ThemeSettings,
  options: Partial<SlideRenderOptions> = {}
) {
  const sharp = (await import("sharp")).default;
  const resolution = validateSlideResolution(options.width ?? 1920, options.height ?? 1080);
  const slideTheme = options.slideTheme ?? fallbackSlideTheme(appTheme);
  const backgroundPath = options.backgroundPath ?? await slideThemeBackgroundPath(slideTheme);
  const logoPath = await churchLogoPath(appChurch);
  const logoData = logoPath ? `data:image/png;base64,${(await sharp(logoPath).png().toBuffer()).toString("base64")}` : undefined;
  const overlay = Buffer.from(slideSvg(item, lines, index, appChurch, { ...resolution, slideTheme, hasImage: Boolean(backgroundPath), logoData }));
  if (!backgroundPath) return sharp(overlay).png().toBuffer();
  return sharp(backgroundPath).resize(resolution.width, resolution.height, { fit: "cover", position: "centre" }).composite([{ input: overlay }]).png().toBuffer();
}

export async function buildItemPptx(item: ServiceItem, appChurch: Church, appTheme: ThemeSettings, options: Partial<SlideRenderOptions> = {}): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = appChurch.name;
  pptx.subject = "ProPresenter import package";
  pptx.title = item.title;
  const slideTheme = options.slideTheme ?? fallbackSlideTheme(appTheme);
  const backgroundPath = options.backgroundPath ?? await slideThemeBackgroundPath(slideTheme);
  const backgroundData = backgroundPath
    ? `data:image/png;base64,${(await (await import("sharp")).default(backgroundPath).resize(1920, 1080, { fit: "cover", position: "centre" }).png().toBuffer()).toString("base64")}`
    : undefined;
  const logoPath = await churchLogoPath(appChurch);
  const { slides } = paginateServiceItem(item, appTheme);
  for (const lines of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: slideTheme.backgroundColor.replace("#", "") };
    if (backgroundData) slide.addImage({ data: backgroundData, x: 0, y: 0, w: 13.333, h: 7.5 });
    const logoPlacement = slideTheme.logoPlacement ?? "TOP_LEFT";
    if (logoPath && logoPlacement !== "NONE") {
      const positions = { TOP_LEFT: [0.9, 0.72], TOP_RIGHT: [10.9, 0.72], BOTTOM_LEFT: [0.9, 6.2], BOTTOM_RIGHT: [10.9, 6.2] } as const;
      const [x, y] = positions[logoPlacement]; slide.addImage({ path: logoPath, x, y, w: 1.5, h: 0.62, transparency: 0 });
    }
    slide.addShape(pptx.ShapeType.rect, { x: 0.67, y: 0.58, w: 12, h: 6.33, fill: { color: slideTheme.overlayColor.replace("#", ""), transparency: 100 - slideTheme.overlayOpacity }, line: { transparency: 100 } });
    slide.addText(appChurch.name, { x: 0.9, y: 0.65, w: 4.5, h: 0.3, fontFace: "Arial", fontSize: 15, color: slideTheme.textColor.replace("#", "") });
    if (item.type !== "SONG") {
      slide.addText(item.title, { x: 1, y: slideTheme.layout === "LOWER_THIRD" ? 4.5 : 1.15, w: 11.33, h: 0.65, align: "center", fontFace: "Arial", fontSize: 32, bold: true, color: slideTheme.textColor.replace("#", ""), margin: 0 });
    }
    slide.addText(lines.join("\n"), {
      x: 1,
      y: slideTheme.layout === "LOWER_THIRD" ? 5.15 : item.type === "SONG" ? 1.35 : 2,
      w: 11.33,
      h: slideTheme.layout === "LOWER_THIRD" ? 1.35 : item.type === "SONG" ? 4.7 : 4.1,
      align: "center",
      valign: "middle",
      breakLine: false,
      fit: "shrink",
      fontFace: "Arial",
      fontSize: item.type === "SONG" ? 34 : 28,
      color: slideTheme.textColor.replace("#", ""),
      margin: 0.08
    });
  }
  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function wrapMeasured(value: string, font: PDFFont, size: number, maxWidth: number) {
  return value.replace(/^\s*---\s*$/gm, "").split(/\r?\n/).flatMap((source) => {
    const words = source.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    return lines;
  });
}

async function buildPdf(title: string, rows: ServiceItem[], includeNotes: boolean, appChurch: Church, appTheme: ThemeSettings): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fontRoot = path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans", "files");
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(fontRoot, "noto-sans-latin-ext-400-normal.woff")),
    readFile(path.join(fontRoot, "noto-sans-latin-ext-700-normal.woff"))
  ]);
  const regular = await document.embedFont(regularBytes);
  const bold = await document.embedFont(boldBytes);
  const logoPath = await churchLogoPath(appChurch);
  const logo = logoPath ? await readFile(/* turbopackIgnore: true */ logoPath).then(async (bytes) => document.embedPng(await (await import("sharp")).default(bytes).png().toBuffer())).catch(() => undefined) : undefined;
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const primary = hexToRgb(appTheme.primaryColor);
  const accent = hexToRgb(appTheme.accentColor);
  let page: PDFPage;
  let y = 0;
  const startPage = () => {
    page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 700, width: pageWidth, height: 92, color: rgb(...primary) });
    page.drawText(appChurch.name, { x: margin, y: 750, font: bold, size: 20, color: rgb(1, 1, 1) });
    page.drawText(title, { x: margin, y: 726, font: regular, size: 11, color: rgb(...accent) });
    if (logo) page.drawImage(logo, { x: pageWidth - margin - 72, y: 722, width: 72, height: 48 });
    y = 660;
  };
  const ensureLine = (height = 18) => { if (y - height < 58) startPage(); };
  const drawLines = (lines: string[], size: number, lineHeight: number, color: [number, number, number], font = regular) => {
    for (const line of lines) {
      ensureLine(lineHeight);
      if (line) page.drawText(line, { x: margin, y, font, size, color: rgb(...color) });
      y -= lineHeight;
    }
  };
  startPage();
  for (const [index, item] of rows.entries()) {
    ensureLine(44);
    const heading = `${index + 1}. ${item.type.replaceAll("_", " ")} - ${item.title}`;
    drawLines(wrapMeasured(heading, bold, 12, pageWidth - margin * 2), 12, 17, primary, bold);
    y -= 4;
    drawLines(wrapMeasured(item.body, regular, 10, pageWidth - margin * 2), 10, 15, [0.16, 0.18, 0.17]);
    if (includeNotes && item.notes) {
      y -= 3;
      drawLines(wrapMeasured(`Notes: ${item.notes}`, regular, 9, pageWidth - margin * 2), 9, 14, [0.38, 0.44, 0.42]);
    }
    if (includeNotes && item.durationMinutes) drawLines([`Duration: ${item.durationMinutes} minutes`], 9, 14, [0.38, 0.44, 0.42]);
    y -= 14;
  }
  return Buffer.from(await document.save());
}

export async function buildTextPdf(plan: ServicePlan, appChurch: Church, appTheme: ThemeSettings): Promise<Buffer> {
  return buildPdf(`${plan.title} Text Pack`, itemsForExport(plan, "PDF"), false, appChurch, appTheme);
}

export async function buildRunSheetPdf(plan: ServicePlan, appChurch: Church, appTheme: ThemeSettings): Promise<Buffer> {
  return buildPdf(`${plan.title} Run Sheet`, orderedItems(plan), true, appChurch, appTheme);
}
