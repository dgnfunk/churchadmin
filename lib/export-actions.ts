"use server";

import { requireScope } from "@/lib/auth";
import { listExportJobs } from "@/lib/export-jobs";
import { prisma } from "@/lib/prisma";
import { exportFilePath } from "@/lib/file-storage";
import { unlink } from "node:fs/promises";
import { validateSlideResolution } from "@/lib/slide-themes";
import type { ExportKind } from "@/lib/domain";

export async function getExportJobs() {
  const user = await requireScope("services");
  return listExportJobs(user.churchId);
}

export async function createProPresenterExport(input: { servicePlanId: string; width: number; height: number }) {
  return createExportJob({ ...input, kind: "PROPRESENTER_PACKAGE" });
}

export async function createExportJob(input: { servicePlanId: string; kind: ExportKind; width?: number; height?: number }) {
  const user = await requireScope("services");
  const usesResolution = input.kind === "PROPRESENTER_PACKAGE" || input.kind === "SLIDE_IMAGES";
  const resolution = usesResolution ? validateSlideResolution(input.width ?? 1920, input.height ?? 1080) : undefined;
  const plan = await prisma.servicePlan.findFirst({ where: { id: input.servicePlanId, churchId: user.churchId }, select: { id: true } });
  if (!plan) throw new Error("Service plan was not found.");
  const job = await prisma.exportJob.create({
    data: {
      churchId: user.churchId, servicePlanId: plan.id, kind: input.kind, status: "PENDING",
      width: resolution?.width, height: resolution?.height,
      renderOptions: resolution ? { width: resolution.width, height: resolution.height, aspectRatio: "16:9" } : undefined
    }
  });
  return (await listExportJobs(user.churchId)).find((candidate) => candidate.id === job.id)!;
}

export async function cancelExportJob(input: { jobId: string }) {
  const user = await requireScope("services");
  const job = await prisma.exportJob.findFirst({ where: { id: input.jobId, churchId: user.churchId } });
  if (!job || !["PENDING", "PROCESSING"].includes(job.status)) throw new Error("Export job cannot be cancelled.");
  await prisma.exportJob.update({ where: { id: job.id }, data: { cancelRequested: true, ...(job.status === "PENDING" ? { status: "CANCELLED", completedAt: new Date() } : {}) } });
  return { id: job.id };
}

export async function deleteExportJob(input: { jobId: string }) {
  const user = await requireScope("services");
  const job = await prisma.exportJob.findFirst({ where: { id: input.jobId, churchId: user.churchId } });
  if (!job) throw new Error("Export job was not found.");
  if (job.fileName) await unlink(exportFilePath(job.fileName)).catch(() => null);
  await prisma.exportJob.delete({ where: { id: job.id } });
  return { id: job.id };
}
