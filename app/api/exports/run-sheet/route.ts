import { buildRunSheetPdf } from "@/lib/export-service";
import { recordBufferExport } from "@/lib/export-jobs";
import { requirePermission } from "@/lib/auth";
import { getServiceExportData } from "@/lib/service-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const servicePlanId = new URL(request.url).searchParams.get("servicePlanId") ?? undefined;
  const user = await requirePermission("services.export", { servicePlanId });
  const { church, plan, theme } = await getServiceExportData(servicePlanId, user.churchId);
  const pdf = await buildRunSheetPdf(plan, church, theme);
  await recordBufferExport({ churchId: user.churchId, servicePlanId: plan.id, kind: "RUN_SHEET_PDF", baseFileName: `${plan.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-run-sheet.pdf`, buffer: pdf });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${plan.id}-run-sheet.pdf"`
    }
  });
}
