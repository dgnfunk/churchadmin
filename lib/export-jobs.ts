import { createWriteStream } from "node:fs";
import { readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import type { ExportJob, ServiceItem, SlideTheme, ThemeSettings } from "@/lib/domain";
import { buildItemPptx, buildRunSheetPdf, buildSlidePng, buildSlideZipToFile, buildTextPdf, slideThemeBackgroundPath } from "@/lib/export-service";
import { ensureStorageDirectories, exportFilePath, exportStoragePath, mediaFilePath } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { databaseProvider } from "@/lib/database-compat";
import { serializeServicePlan, servicePlanInclude } from "@/lib/service-serialization";
import { paginateServiceItem, propresenterText } from "@/lib/slide-pagination";
import { resolveSlideTheme, validateSlideResolution } from "@/lib/slide-themes";
import { getServiceExportData } from "@/lib/service-data";

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeJob(job: {
  id: string; churchId: string; servicePlanId: string | null; kind: ExportJob["kind"];
  status: ExportJob["status"]; fileName: string | null; sizeBytes: bigint | null;
  errorMessage: string | null; expiresAt: Date | null; createdAt: Date;
  width: number | null; height: number | null; renderOptions: unknown;
  progress: number; attempts: number; startedAt: Date | null; completedAt: Date | null; cancelRequested: boolean;
}): ExportJob {
  return {
    id: job.id,
    churchId: job.churchId,
    servicePlanId: job.servicePlanId ?? undefined,
    kind: job.kind,
    status: job.status,
    fileName: job.fileName ?? undefined,
    sizeBytes: job.sizeBytes == null ? undefined : Number(job.sizeBytes),
    errorMessage: job.errorMessage ?? undefined,
    expiresAt: job.expiresAt?.toISOString(),
    createdAt: job.createdAt.toISOString(),
    width: job.width ?? undefined,
    height: job.height ?? undefined,
    renderOptions: job.renderOptions && typeof job.renderOptions === "object" && !Array.isArray(job.renderOptions) ? job.renderOptions as Record<string, unknown> : undefined
    ,progress: job.progress
    ,attempts: job.attempts
    ,startedAt: job.startedAt?.toISOString()
    ,completedAt: job.completedAt?.toISOString()
    ,cancelRequested: job.cancelRequested
  };
}

export async function cleanupExpiredExports() {
  await ensureStorageDirectories();
  const expired = await prisma.exportJob.findMany({ where: { expiresAt: { lt: new Date() }, fileName: { not: null } } });
  for (const job of expired) {
    if (job.fileName) await unlink(exportFilePath(job.fileName)).catch(() => null);
  }
  if (expired.length) await prisma.exportJob.deleteMany({ where: { id: { in: expired.map((job) => job.id) } } });
  const entries = await readdir(exportStoragePath).catch(() => []);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const name of entries.filter((entry) => entry.endsWith(".tmp"))) {
    const temporary = exportFilePath(name);
    const details = await stat(temporary).catch(() => null);
    if (details && details.mtimeMs < cutoff) await unlink(temporary).catch(() => null);
  }
}

export async function recordBufferExport(input: {
  churchId: string;
  servicePlanId: string;
  kind: "SLIDE_IMAGES" | "TEXT_PDF" | "RUN_SHEET_PDF";
  baseFileName: string;
  buffer: Buffer;
  width?: number;
  height?: number;
}) {
  await ensureStorageDirectories();
  const job = await prisma.exportJob.create({ data: {
    churchId: input.churchId, servicePlanId: input.servicePlanId, kind: input.kind, status: "PENDING",
    width: input.width, height: input.height,
    renderOptions: input.width && input.height ? { width: input.width, height: input.height, aspectRatio: "16:9" } : undefined
  } });
  const extension = pathExt(input.baseFileName);
  const stem = input.baseFileName.slice(0, -extension.length);
  const fileName = `${stem}-${job.id.slice(-6)}${extension}`;
  const destination = exportFilePath(fileName);
  try {
    await writeFile(destination, input.buffer, { flag: "wx" });
    await prisma.exportJob.update({ where: { id: job.id }, data: {
      status: "COMPLETE", fileName, fileUrl: `/api/exports/jobs/${job.id}`,
      sizeBytes: BigInt(input.buffer.length), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    } });
  } catch (error) {
    await unlink(destination).catch(() => null);
    await prisma.exportJob.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Export failed" } });
    throw error;
  }
}

export async function recordFileExport(input: {
  churchId: string;
  servicePlanId: string;
  kind: "SLIDE_IMAGES";
  baseFileName: string;
  width: number;
  height: number;
  write: (destination: string) => Promise<void>;
}) {
  await ensureStorageDirectories();
  const job = await prisma.exportJob.create({ data: {
    churchId: input.churchId, servicePlanId: input.servicePlanId, kind: input.kind,
    status: "PROCESSING", progress: 1, attempts: 1, startedAt: new Date(), lockedAt: new Date(),
    width: input.width, height: input.height,
    renderOptions: { width: input.width, height: input.height, aspectRatio: "16:9" }
  } });
  const extension = pathExt(input.baseFileName);
  const stem = input.baseFileName.slice(0, -extension.length);
  const fileName = `${stem}-${job.id.slice(-6)}${extension}`;
  const destination = exportFilePath(fileName);
  const temporary = `${destination}.${job.id}.tmp`;
  try {
    await input.write(temporary);
    await rename(temporary, destination);
    const details = await stat(destination);
    await prisma.exportJob.update({ where: { id: job.id }, data: {
      status: "COMPLETE", progress: 100, completedAt: new Date(), lockedAt: null,
      fileName, fileUrl: `/api/exports/jobs/${job.id}`, sizeBytes: BigInt(details.size),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    } });
    return { id: job.id, fileName, destination, size: details.size };
  } catch (error) {
    await unlink(temporary).catch(() => null);
    await unlink(destination).catch(() => null);
    await prisma.exportJob.update({ where: { id: job.id }, data: {
      status: "FAILED", completedAt: new Date(), lockedAt: null,
      errorMessage: error instanceof Error ? error.message : "Export failed"
    } });
    throw error;
  }
}

function pathExt(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index) : "";
}

export async function listExportJobs(churchId: string): Promise<ExportJob[]> {
  await cleanupExpiredExports();
  const jobs = await prisma.exportJob.findMany({ where: { churchId }, orderBy: { createdAt: "desc" }, take: 20 });
  return jobs.map(serializeJob);
}

function themeFromRow(theme: {
  churchId: string; primaryColor: string; accentColor: string; mode: string; logoUrl: string | null;
  headingStyle: string; exportHeader: string; slideTemplate: string; songLinesPerSlide: number;
  textLinesPerSlide: number; maxCharactersPerSlide: number;
  defaultSlideWidth: number; defaultSlideHeight: number;
}): ThemeSettings {
  return {
    churchId: theme.churchId,
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    mode: theme.mode === "dark" ? "dark" : "light",
    logoUrl: theme.logoUrl ?? undefined,
    headingStyle: ["classic", "modern", "serif"].includes(theme.headingStyle) ? theme.headingStyle as ThemeSettings["headingStyle"] : "classic",
    exportHeader: theme.exportHeader === "minimal" ? "minimal" : "branded",
    slideTemplate: theme.slideTemplate === "lower-third" ? "lower-third" : "centered",
    songLinesPerSlide: theme.songLinesPerSlide,
    textLinesPerSlide: theme.textLinesPerSlide,
    maxCharactersPerSlide: theme.maxCharactersPerSlide,
    defaultSlideWidth: theme.defaultSlideWidth,
    defaultSlideHeight: theme.defaultSlideHeight
  };
}

function manifestRows(items: ServiceItem[], theme: ThemeSettings, plan: Parameters<typeof resolveSlideTheme>[1], slideThemes: SlideTheme[]) {
  return items.map((item, index) => ({
    order: index + 1,
    title: item.title,
    type: item.type,
    durationMinutes: item.durationMinutes ?? "",
    tags: item.exportTags.join("|"),
    slideCount: item.exportTags.includes("SLIDE") ? paginateServiceItem(item, theme).slides.length : 0,
    media: item.mediaAssets.map((asset) => asset.originalName).join("|"),
    theme: resolveSlideTheme(item, plan, slideThemes)?.name ?? "Church Default"
  }));
}

export async function generateProPresenterPackage(jobId: string) {
  await ensureStorageDirectories();
  const job = await prisma.exportJob.findUnique({
    where: { id: jobId },
    include: {
      church: { include: { theme: true, slideThemes: { include: { backgroundAsset: true } } } },
      servicePlan: { include: servicePlanInclude }
    }
  });
  if (!job?.servicePlan || !job.church.theme) throw new Error("Export source data is incomplete.");
  if (job.cancelRequested) {
    const cancelled = await prisma.exportJob.update({ where: { id: job.id }, data: { status: "CANCELLED", completedAt: new Date(), progress: 0 } });
    return serializeJob(cancelled);
  }
  const plan = serializeServicePlan(job.servicePlan);
  const church = { id: job.church.id, name: job.church.name, slug: job.church.slug, logoUrl: job.church.logoUrl ?? undefined, logoAssetId: job.church.logoAssetId ?? undefined, timeZone: job.church.timeZone, defaultPhoneRegion: job.church.defaultPhoneRegion };
  const theme = themeFromRow(job.church.theme);
  const slideThemes: SlideTheme[] = job.church.slideThemes.map((slideTheme) => ({
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
  }));
  const resolution = validateSlideResolution(job.width ?? theme.defaultSlideWidth, job.height ?? theme.defaultSlideHeight);
  const date = plan.serviceAt.slice(0, 10);
  const fileName = `${slug(plan.title)}-${date}-propresenter-${job.id.slice(-6)}.zip`;
  const finalPath = exportFilePath(fileName);
  const tempPath = `${finalPath}.${job.id}.tmp`;

  try {
    const archiverModule = await import("archiver") as unknown as {
      ZipArchive: new (options: { zlib: { level: number } }) => import("archiver").Archiver;
    };
    const output = createWriteStream(tempPath, { flags: "wx" });
    const archive = new archiverModule.ZipArchive({ zlib: { level: 6 } });
    const completed = new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
      archive.on("error", reject);
    });
    archive.pipe(output);
    archive.append(
      `IMPORTACION EN PROPRESENTER 7 WINDOWS\n\nRESOLUCION: ${resolution.width}x${resolution.height}\n\nAPARIENCIA EXACTA\n1. Importe los PNG dentro de presentations/.\n2. PPTX es una alternativa visual y ProPresenter 7 Windows puede convertirlo a imagen.\n\nCONTENIDO EDITABLE\n1. Abra File > Import > File.\n2. Importe cada TXT en orden numerico.\n3. Seleccione // como delimitador.\n4. Cree o aplique el Theme indicado en manifest.csv.\n5. Importe el fondo correspondiente desde themes/ y agreguelo como Media Action.\n\nLa app no genera archivos propietarios de Theme de ProPresenter.\n`,
      { name: "README.txt" }
    );
    const rows = manifestRows(plan.items, theme, plan, slideThemes);
    archive.append(JSON.stringify({ church: church.name, service: plan.title, serviceAt: plan.serviceAt, resolution, items: rows }, null, 2), { name: "manifest.json" });
    archive.append([
      ["order", "title", "type", "durationMinutes", "tags", "slideCount", "media", "theme"].join(","),
      ...rows.map((row) => Object.values(row).map(csvCell).join(","))
    ].join("\n"), { name: "manifest.csv" });
    archive.append(await buildRunSheetPdf(plan, church, theme), { name: "run-sheet.pdf" });
    archive.append(await buildTextPdf(plan, church, theme), { name: "text-pack.pdf" });
    archive.append(plan.items.filter((item) => item.exportTags.includes("SLIDE")).map((item) => propresenterText(item, theme)).join("\n//\n"), { name: "presentations/00-complete-service.txt" });
    await prisma.exportJob.update({ where: { id: job.id }, data: { progress: 20 } });

    const usedThemes = [...new Map(plan.items.flatMap((item) => {
      const resolved = resolveSlideTheme(item, plan, slideThemes);
      return resolved ? [[resolved.id, resolved] as const] : [];
    })).values()];
    for (const slideTheme of usedThemes) {
      const themeFolder = `themes/${slug(slideTheme.name)}`;
      const backgroundPath = await slideThemeBackgroundPath(slideTheme);
      const sharp = (await import("sharp")).default;
      const background = backgroundPath
        ? await sharp(backgroundPath).resize(resolution.width, resolution.height, { fit: "cover", position: "centre" }).png().toBuffer()
        : await sharp({ create: { width: resolution.width, height: resolution.height, channels: 4, background: slideTheme.backgroundColor } }).png().toBuffer();
      archive.append(background, { name: `${themeFolder}/background.png` });
      const previewItem: ServiceItem = {
        id: "theme-preview", servicePlanId: plan.id, type: "SCRIPTURE", title: slideTheme.name,
        body: "Theme preview", sortOrder: 0, exportTags: ["SLIDE"], mediaAssets: [], slideThemeId: slideTheme.id
      };
      archive.append(
        await buildSlidePng(previewItem, ["Theme preview"], 0, church, theme, { ...resolution, slideTheme, backgroundPath }),
        { name: `${themeFolder}/preview.png` }
      );
      archive.append(JSON.stringify({
        name: slideTheme.name, backgroundType: slideTheme.backgroundType,
        backgroundColor: slideTheme.backgroundColor, backgroundAsset: slideTheme.backgroundAsset?.originalName ?? null,
        overlayColor: slideTheme.overlayColor, overlayOpacity: slideTheme.overlayOpacity,
        textColor: slideTheme.textColor, accentColor: slideTheme.accentColor,
        layout: slideTheme.layout, fontFamily: slideTheme.fontFamily, titleFontSize: slideTheme.titleFontSize,
        bodyFontSize: slideTheme.bodyFontSize, fontWeight: slideTheme.fontWeight, safeMargin: slideTheme.safeMargin,
        logoPlacement: slideTheme.logoPlacement, resolution
      }, null, 2), { name: `${themeFolder}/theme-spec.json` });
    }

    for (const [index, item] of plan.items.entries()) {
      const state = await prisma.exportJob.findUnique({ where: { id: job.id }, select: { cancelRequested: true } });
      if (state?.cancelRequested) throw new ExportCancelledError();
      const prefix = `${String(index + 1).padStart(2, "0")}-${slug(item.title)}`;
      if (item.exportTags.includes("SLIDE")) {
        const slideTheme = resolveSlideTheme(item, plan, slideThemes);
        const backgroundPath = await slideThemeBackgroundPath(slideTheme);
        const base = `presentations/${prefix}`;
        archive.append(propresenterText(item, theme), { name: `${base}/${prefix}.txt` });
        archive.append(await buildItemPptx(item, church, theme, { ...resolution, slideTheme, backgroundPath }), { name: `${base}/${prefix}.pptx` });
        const pages = paginateServiceItem(item, theme).slides;
        for (const [pageIndex, lines] of pages.entries()) {
          archive.append(await buildSlidePng(item, lines, index, church, theme, { ...resolution, slideTheme, backgroundPath }), {
            name: `${base}/png/${String(pageIndex + 1).padStart(3, "0")}.png`
          });
        }
      }
      for (const asset of item.mediaAssets) {
        const storedAsset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id }, select: { storageKey: true } });
        archive.file(mediaFilePath(storedAsset.storageKey), {
          name: `media/${prefix}-${asset.originalName}`
        });
      }
      await prisma.exportJob.update({ where: { id: job.id }, data: { progress: 25 + Math.round(((index + 1) / Math.max(1, plan.items.length)) * 70) } });
    }
    await archive.finalize();
    await completed;
    await unlink(finalPath).catch(() => null);
    await rename(tempPath, finalPath);
    const { size } = await import("node:fs/promises").then(({ stat }) => stat(finalPath));
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "COMPLETE", progress: 100, completedAt: new Date(), fileName, fileUrl: `/api/exports/jobs/${job.id}`, sizeBytes: BigInt(size), expiresAt, errorMessage: null, lockedAt: null }
    });
    return serializeJob(updated);
  } catch (error) {
    await unlink(tempPath).catch(() => null);
    const cancelled = error instanceof ExportCancelledError;
    const message = error instanceof Error ? error.message : "Unknown export error";
    await prisma.exportJob.update({ where: { id: job.id }, data: { status: cancelled ? "CANCELLED" : "FAILED", completedAt: new Date(), lockedAt: null, errorMessage: cancelled ? null : message } });
    if (!cancelled) throw error;
    return serializeJob(await prisma.exportJob.findUniqueOrThrow({ where: { id: job.id } }));
  }
}

class ExportCancelledError extends Error {
  constructor() { super("Export cancelled"); }
}

async function generateStandaloneExport(jobId: string) {
  await ensureStorageDirectories();
  const job = await prisma.exportJob.findUniqueOrThrow({ where: { id: jobId } });
  if (!job.servicePlanId || job.kind === "PROPRESENTER_PACKAGE") throw new Error("Invalid standalone export job.");
  const { church, plan, theme, slideThemes } = await getServiceExportData(job.servicePlanId, job.churchId);
  const stem = `${slug(plan.title)}-${plan.serviceAt.slice(0, 10)}`;
  const details = job.kind === "SLIDE_IMAGES"
    ? { fileName: `${stem}-slides-${job.id.slice(-6)}.zip`, buffer: null }
    : job.kind === "TEXT_PDF"
      ? { fileName: `${stem}-text-${job.id.slice(-6)}.pdf`, buffer: await buildTextPdf(plan, church, theme) }
      : { fileName: `${stem}-run-sheet-${job.id.slice(-6)}.pdf`, buffer: await buildRunSheetPdf(plan, church, theme) };
  const finalPath = exportFilePath(details.fileName);
  const tempPath = `${finalPath}.${job.id}.tmp`;
  try {
    await prisma.exportJob.update({ where: { id: job.id }, data: { progress: 20 } });
    if (job.kind === "SLIDE_IMAGES") {
      const resolution = validateSlideResolution(job.width ?? theme.defaultSlideWidth, job.height ?? theme.defaultSlideHeight);
      await buildSlideZipToFile(plan, church, theme, tempPath, slideThemes, resolution);
    } else {
      await writeFile(tempPath, details.buffer!, { flag: "wx" });
    }
    const state = await prisma.exportJob.findUnique({ where: { id: job.id }, select: { cancelRequested: true } });
    if (state?.cancelRequested) throw new ExportCancelledError();
    await rename(tempPath, finalPath);
    const file = await stat(finalPath);
    return serializeJob(await prisma.exportJob.update({ where: { id: job.id }, data: {
      status: "COMPLETE", progress: 100, completedAt: new Date(), lockedAt: null,
      fileName: details.fileName, fileUrl: `/api/exports/jobs/${job.id}`, sizeBytes: BigInt(file.size),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), errorMessage: null
    } }));
  } catch (error) {
    await unlink(tempPath).catch(() => null);
    await unlink(finalPath).catch(() => null);
    const cancelled = error instanceof ExportCancelledError;
    await prisma.exportJob.update({ where: { id: job.id }, data: {
      status: cancelled ? "CANCELLED" : "FAILED", completedAt: new Date(), lockedAt: null,
      errorMessage: cancelled ? null : error instanceof Error ? error.message : "Export failed"
    } });
    if (!cancelled) throw error;
  }
}

export async function processNextExportJob() {
  const claimedId = await prisma.$transaction(async (tx) => {
    const rows = databaseProvider === "mysql"
      ? await tx.$queryRawUnsafe<Array<{ id: string }>>("SELECT `id` FROM `ExportJob` WHERE `status` = 'PENDING' AND `cancelRequested` = false ORDER BY `createdAt` ASC LIMIT 1 FOR UPDATE SKIP LOCKED")
      : await tx.$queryRawUnsafe<Array<{ id: string }>>("SELECT \"id\" FROM \"ExportJob\" WHERE \"status\" = 'PENDING' AND \"cancelRequested\" = false ORDER BY \"createdAt\" ASC LIMIT 1 FOR UPDATE SKIP LOCKED");
    if (!rows[0]) return null;
    await tx.exportJob.update({ where: { id: rows[0].id }, data: { status: "PROCESSING", startedAt: new Date(), lockedAt: new Date(), attempts: { increment: 1 }, progress: 1 } });
    return rows[0].id;
  });
  if (!claimedId) return false;
  const job = await prisma.exportJob.findUniqueOrThrow({ where: { id: claimedId }, select: { kind: true } });
  const task = job.kind === "PROPRESENTER_PACKAGE" ? generateProPresenterPackage(claimedId) : generateStandaloneExport(claimedId);
  await task.catch((error) => console.error(JSON.stringify({ level: "error", event: "export_failed", jobId: claimedId, message: error instanceof Error ? error.message : String(error) })));
  return true;
}
