"use server";

import { revalidatePath } from "next/cache";
import { requireScope } from "@/lib/auth";
import { moveMediaToTrash } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mediaFilePath } from "@/lib/file-storage";
import { formError } from "@/lib/form-state";

export async function deleteMediaAsset(input: { assetId: string }) {
  const user = await requireScope("services");
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: input.assetId, churchId: user.churchId }
  });
  if (!asset) throw new Error("Media asset was not found.");
  const themeReference = await prisma.slideTheme.findFirst({ where: { backgroundAssetId: asset.id }, select: { id: true } });
  if (themeReference) throw new Error("This asset is used by a slide theme and must be replaced from Theme Settings.");
  await moveMediaToTrash(asset.storageKey);
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  revalidatePath("/", "layout");
  return { id: asset.id, serviceItemId: asset.serviceItemId };
}

export async function reuseMediaAsset(formData: FormData) {
  const user = await requireScope("services"); const assetId = String(formData.get("assetId") ?? ""); const serviceItemId = String(formData.get("serviceItemId") ?? "");
  const [asset, item] = await Promise.all([prisma.mediaAsset.findFirst({ where: { id: assetId, churchId: user.churchId } }), prisma.serviceItem.findFirst({ where: { id: serviceItemId, servicePlan: { churchId: user.churchId } } })]);
  if (!asset || !item) return formError("El archivo o el elemento de destino ya no está disponible.", { serviceItemId: "Selecciona otro elemento." });
  const extension = path.extname(asset.storageKey); const storageKey = path.join("assets", user.churchId, `${randomUUID()}${extension}`); const destination = mediaFilePath(storageKey); await mkdir(path.dirname(destination), { recursive: true }); await copyFile(mediaFilePath(asset.storageKey), destination);
  await prisma.mediaAsset.create({ data: { churchId: user.churchId, serviceItemId: item.id, role: asset.role, originalName: asset.originalName, storageKey, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksum: asset.checksum } });
  revalidatePath("/media"); revalidatePath("/services");
}
