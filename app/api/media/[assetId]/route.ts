import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { requireUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { mediaReadStream, mediaFilePath } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await requireUser();
  if (!canAccess(user, "services") && !canAccess(user, "theme")) return new Response("Forbidden", { status: 403 });
  const { assetId } = await context.params;
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, churchId: user.churchId } });
  if (!asset) return new Response("Not found", { status: 404 });
  const size = (await stat(mediaFilePath(asset.storageKey))).size;
  return new Response(Readable.toWeb(mediaReadStream(asset.storageKey)) as ReadableStream, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(size),
      "Content-Disposition": `${new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment"}; filename="${asset.originalName.replace(/["\r\n]/g, "_")}"`
    }
  });
}
