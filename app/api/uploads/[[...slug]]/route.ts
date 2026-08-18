import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { FileStore } from "@tus/file-store";
import { Server } from "@tus/server";
import { fileTypeFromFile } from "file-type";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { ensureStorageDirectories, mediaFilePath, mediaStoragePath, removeFileIfPresent } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uploadDirectory = path.join(mediaStoragePath, "uploads", "tus");
const allowedTypes = new Set(["video/mp4", "video/quicktime", "video/webm", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "image/png", "image/jpeg", "image/webp"]);

async function currentServicesUser() { const user = await getCurrentUser(); if (!user || !canAccess(user, "services")) throw { status_code: 401, body: "Authentication required" }; return user; }

const server = new Server({
  path: "/api/uploads", datastore: new FileStore({ directory: uploadDirectory, expirationPeriodInMilliseconds: 24 * 60 * 60 * 1000 }),
  maxSize: Number(process.env.MAX_MEDIA_BYTES ?? 2 * 1024 * 1024 * 1024), relativeLocation: true,
  async onIncomingRequest() { await ensureStorageDirectories(); await currentServicesUser(); },
  async onUploadCreate(_request, upload) { const user = await currentServicesUser(); const metadata = upload.metadata ?? {}; const item = await prisma.serviceItem.findFirst({ where: { id: metadata.serviceItemId ?? "", servicePlan: { churchId: user.churchId } }, select: { id: true } }); if (!item || !upload.size || !metadata.filename) throw { status_code: 400, body: "Valid serviceItemId, filename, and upload size are required" }; await prisma.uploadSession.create({ data: { id: upload.id, churchId: user.churchId, userId: user.id, purpose: "service-media", originalName: path.basename(metadata.filename), mimeType: metadata.filetype ?? "application/octet-stream", sizeBytes: BigInt(upload.size), storageKey: upload.id, metadata: { serviceItemId: item.id, role: metadata.role ?? "PRIMARY" }, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }); return {}; },
  async onUploadFinish(_request, upload) { const user = await currentServicesUser(); const source = path.join(uploadDirectory, upload.id); const session = await prisma.uploadSession.findFirst({ where: { id: upload.id, churchId: user.churchId } }); if (!session) throw { status_code: 404, body: "Upload session not found" }; const detected = await fileTypeFromFile(source); if (!detected || !allowedTypes.has(detected.mime)) { await removeFileIfPresent(source); throw { status_code: 415, body: "Unsupported file contents" }; } const metadata = session.metadata as { serviceItemId?: string; role?: string } | null; const item = await prisma.serviceItem.findFirst({ where: { id: metadata?.serviceItemId ?? "", servicePlan: { churchId: user.churchId } }, select: { id: true } }); if (!item) throw { status_code: 404, body: "Service item not found" }; const roles = ["PRIMARY", "BACKGROUND", "AUDIO", "REFERENCE"] as const; const role = roles.includes(metadata?.role as typeof roles[number]) ? metadata!.role as typeof roles[number] : "PRIMARY"; const storageKey = path.join("assets", user.churchId, `${randomUUID()}.${detected.ext}`); const destination = mediaFilePath(storageKey); await mkdir(path.dirname(destination), { recursive: true }); await rename(source, destination); const checksum = await new Promise<string>((resolve, reject) => { const hash = createHash("sha256"); createReadStream(destination).on("data", (chunk) => hash.update(chunk)).on("end", () => resolve(hash.digest("hex"))).on("error", reject); }); const duplicate = await prisma.mediaAsset.findFirst({ where: { churchId: user.churchId, checksum, serviceItemId: item.id } }); if (!duplicate) await prisma.mediaAsset.create({ data: { churchId: user.churchId, serviceItemId: item.id, role, originalName: session.originalName, storageKey, mimeType: detected.mime, sizeBytes: session.sizeBytes, checksum } }); else await removeFileIfPresent(destination); await prisma.uploadSession.update({ where: { id: session.id }, data: { completedAt: new Date(), offsetBytes: session.sizeBytes, storageKey: duplicate?.storageKey ?? storageKey } }); return {}; }
});

const handler = (request: Request) => server.handleWeb(request);
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE, handler as OPTIONS, handler as HEAD };
