import { access, constants } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { ensureStorageDirectories, exportStoragePath, mediaStoragePath } from "@/lib/file-storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureStorageDirectories();
    await Promise.all([prisma.$queryRaw`SELECT 1`, access(mediaStoragePath, constants.R_OK | constants.W_OK), access(exportStoragePath, constants.R_OK | constants.W_OK)]);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "healthcheck_failed", message: error instanceof Error ? error.message : String(error) }));
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
