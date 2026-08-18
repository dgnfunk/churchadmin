import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import Busboy from "busboy";
import { requireScope } from "@/lib/auth";
import { ensureStorageDirectories, mediaFilePath, mediaStoragePath, removeFileIfPresent } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedTypes = new Set([
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4",
  "image/png", "image/jpeg", "image/webp"
]);
const serviceMediaMaxBytes = Number(process.env.MAX_MEDIA_BYTES ?? 2 * 1024 * 1024 * 1024);
const themeImageMaxBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const isThemeUpload = new URL(request.url).searchParams.get("purpose") === "theme";
  const isLogoUpload = new URL(request.url).searchParams.get("purpose") === "logo";
  const user = await requireScope(isThemeUpload || isLogoUpload ? "theme" : "services");
  const maxBytes = isThemeUpload || isLogoUpload ? themeImageMaxBytes : serviceMediaMaxBytes;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > maxBytes + 1024 * 1024) {
    return Response.json({ error: "File exceeds the configured upload limit." }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "Upload body is required." }, { status: 400 });
  await ensureStorageDirectories();

  const fields: Record<string, string> = {};
  let upload: { tempPath: string; originalName: string; mimeType: string; sizeBytes: number; checksum: string } | null = null;
  let uploadErrorMessage: string | null = null;
  const parser = Busboy({ headers: Object.fromEntries(request.headers.entries()), limits: { files: 1, fileSize: maxBytes, fields: 8 } });

  await new Promise<void>((resolve, reject) => {
    const writes: Promise<void>[] = [];
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (_name, stream, info) => {
      const tempPath = path.join(mediaStoragePath, "uploads", `${randomUUID()}.upload`);
      const output = createWriteStream(tempPath, { flags: "wx" });
      const hash = createHash("sha256");
      let sizeBytes = 0;
      writes.push(new Promise<void>((resolveWrite, rejectWrite) => {
        output.on("finish", () => {
          upload = { tempPath, originalName: path.basename(info.filename), mimeType: info.mimeType, sizeBytes, checksum: hash.digest("hex") };
          resolveWrite();
        });
        output.on("error", rejectWrite);
      }));
      stream.on("data", (chunk: Buffer) => { sizeBytes += chunk.length; hash.update(chunk); });
      stream.on("limit", () => { uploadErrorMessage = "File exceeds the configured upload limit."; });
      stream.on("error", reject);
      stream.pipe(output);
    });
    parser.on("error", reject);
    parser.on("finish", () => { void Promise.all(writes).then(() => resolve(), reject); });
    Readable.fromWeb(request.body as never).pipe(parser);
  });

  if (uploadErrorMessage || !upload) {
    return Response.json({ error: uploadErrorMessage ?? "A media file is required." }, { status: uploadErrorMessage ? 413 : 400 });
  }
  const uploaded = upload as { tempPath: string; originalName: string; mimeType: string; sizeBytes: number; checksum: string };
  const detected = await import("file-type").then(({ fileTypeFromFile }) => fileTypeFromFile(uploaded.tempPath));
  if (!detected || !allowedTypes.has(detected.mime)) {
    await removeFileIfPresent(uploaded.tempPath);
    return Response.json({ error: "The file contents do not match an allowed media format." }, { status: 415 });
  }
  uploaded.mimeType = detected.mime;
  if (!allowedTypes.has(uploaded.mimeType)) {
    await removeFileIfPresent(uploaded.tempPath);
    return Response.json({ error: "Unsupported media type." }, { status: 415 });
  }
  if ((isThemeUpload || isLogoUpload) && !uploaded.mimeType.startsWith("image/")) {
    await removeFileIfPresent(uploaded.tempPath);
    return Response.json({ error: "Theme backgrounds must be PNG, JPEG, or WebP images." }, { status: 415 });
  }
  if (isLogoUpload) {
    const storageKey = path.join("assets", user.churchId, `${randomUUID()}.${detected.ext}`);
    const destination = mediaFilePath(storageKey);
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(destination), { recursive: true }));
    await rename(uploaded.tempPath, destination);
    const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { logoAssetId: true } });
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({ data: { churchId: user.churchId, role: "REFERENCE", originalName: uploaded.originalName, storageKey, mimeType: uploaded.mimeType, sizeBytes: BigInt(uploaded.sizeBytes), checksum: uploaded.checksum } });
      await tx.church.update({ where: { id: user.churchId }, data: { logoAssetId: created.id } }); return created;
    });
    if (church.logoAssetId) {
      const previous = await prisma.mediaAsset.findFirst({ where: { id: church.logoAssetId, churchId: user.churchId } });
      if (previous) { const { moveMediaToTrash } = await import("@/lib/file-storage"); await moveMediaToTrash(previous.storageKey); await prisma.mediaAsset.delete({ where: { id: previous.id } }); }
    }
    return Response.json({ id: asset.id, originalName: asset.originalName, sizeBytes: Number(asset.sizeBytes), role: asset.role });
  }
  if (isThemeUpload) {
    const slideTheme = await prisma.slideTheme.findFirst({
      where: { id: fields.slideThemeId, churchId: user.churchId },
      select: { id: true, backgroundAssetId: true }
    });
    if (!slideTheme) {
      await removeFileIfPresent(uploaded.tempPath);
      return Response.json({ error: "Slide theme was not found." }, { status: 404 });
    }
    const storageKey = path.join("assets", user.churchId, `${randomUUID()}${path.extname(uploaded.originalName).toLowerCase()}`);
    const destination = mediaFilePath(storageKey);
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(destination), { recursive: true }));
    await rename(uploaded.tempPath, destination);
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({ data: {
        churchId: user.churchId, serviceItemId: null, role: "BACKGROUND", originalName: uploaded.originalName,
        storageKey, mimeType: uploaded.mimeType, sizeBytes: BigInt(uploaded.sizeBytes), checksum: uploaded.checksum
      } });
      await tx.slideTheme.update({ where: { id: slideTheme.id }, data: { backgroundAssetId: created.id, backgroundType: "IMAGE" } });
      return created;
    });
    if (slideTheme.backgroundAssetId) {
      const previous = await prisma.mediaAsset.findUnique({ where: { id: slideTheme.backgroundAssetId } });
      if (previous) {
        const references = await prisma.slideTheme.count({ where: { backgroundAssetId: previous.id } });
        if (!references) {
          const { moveMediaToTrash } = await import("@/lib/file-storage");
          await moveMediaToTrash(previous.storageKey);
          await prisma.mediaAsset.delete({ where: { id: previous.id } });
        }
      }
    }
    return Response.json({ id: asset.id, originalName: asset.originalName, sizeBytes: Number(asset.sizeBytes), role: asset.role });
  }
  const item = await prisma.serviceItem.findFirst({
    where: { id: fields.serviceItemId, servicePlan: { churchId: user.churchId } },
    select: { id: true }
  });
  if (!item) {
    await removeFileIfPresent(uploaded.tempPath);
    return Response.json({ error: "Service item was not found." }, { status: 404 });
  }
  const roles = ["PRIMARY", "BACKGROUND", "AUDIO", "REFERENCE"] as const;
  const role = roles.includes(fields.role as typeof roles[number]) ? fields.role as typeof roles[number] : "PRIMARY";
  const storageKey = path.join("assets", user.churchId, `${randomUUID()}${path.extname(uploaded.originalName).toLowerCase()}`);
  const destination = mediaFilePath(storageKey);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(destination), { recursive: true }));
  await rename(uploaded.tempPath, destination);
  const asset = await prisma.mediaAsset.create({
    data: {
      churchId: user.churchId,
      serviceItemId: item.id,
      role,
      originalName: uploaded.originalName,
      storageKey,
      mimeType: uploaded.mimeType,
      sizeBytes: BigInt(uploaded.sizeBytes),
      checksum: uploaded.checksum
    }
  });
  return Response.json({ id: asset.id, originalName: asset.originalName, sizeBytes: Number(asset.sizeBytes), role: asset.role });
}
