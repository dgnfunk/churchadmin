import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { requireScope } from "@/lib/auth";
import { exportFilePath } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const user = await requireScope("services");
  const { jobId } = await context.params;
  const job = await prisma.exportJob.findFirst({ where: { id: jobId, churchId: user.churchId, status: "COMPLETE" } });
  if (!job?.fileName || (job.expiresAt && job.expiresAt < new Date())) return new Response("Not found", { status: 404 });
  const filePath = exportFilePath(job.fileName);
  const size = (await stat(filePath)).size;
  const contentType = job.fileName.endsWith(".pdf") ? "application/pdf" : "application/zip";
  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${job.fileName}"`
    }
  });
}
