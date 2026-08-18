import { createReadStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

export const mediaStoragePath = path.resolve(/* turbopackIgnore: true */ process.env.MEDIA_STORAGE_PATH ?? ".tmp/media");
export const exportStoragePath = path.resolve(/* turbopackIgnore: true */ process.env.EXPORT_STORAGE_PATH ?? ".tmp/exports");

export async function ensureStorageDirectories() {
  await Promise.all([
    mkdir(path.join(mediaStoragePath, "assets"), { recursive: true }),
    mkdir(path.join(mediaStoragePath, "trash"), { recursive: true }),
    mkdir(path.join(mediaStoragePath, "uploads"), { recursive: true }),
    mkdir(exportStoragePath, { recursive: true })
  ]);
}

function resolveInside(root: string, key: string) {
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage key.");
  return resolved;
}

export function mediaFilePath(storageKey: string) {
  return resolveInside(mediaStoragePath, storageKey);
}

export function exportFilePath(fileName: string) {
  return resolveInside(exportStoragePath, fileName);
}

export function mediaReadStream(storageKey: string) {
  return createReadStream(/* turbopackIgnore: true */ mediaFilePath(storageKey));
}

export async function moveMediaToTrash(storageKey: string) {
  await ensureStorageDirectories();
  const source = mediaFilePath(storageKey);
  const target = path.join(mediaStoragePath, "trash", `${Date.now()}-${path.basename(storageKey)}`);
  await rename(source, target).catch(() => null);
  return target;
}

export async function removeFileIfPresent(filePath: string) {
  await unlink(filePath).catch(() => null);
}

export async function fileSize(filePath: string) {
  return (await stat(filePath)).size;
}
