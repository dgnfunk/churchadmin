import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { buildSlideZipToFile } from "@/lib/export-service";
import { recordFileExport } from "@/lib/export-jobs";
import { requirePermission } from "@/lib/auth";
import { getServiceExportData } from "@/lib/service-data";
import { validateSlideResolution } from "@/lib/slide-themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const servicePlanId = params.get("servicePlanId") ?? undefined;
  const user = await requirePermission("services.export", { servicePlanId });
  const { church, plan, theme, slideThemes } = await getServiceExportData(servicePlanId, user.churchId);
  const resolution = validateSlideResolution(Number(params.get("width") ?? theme.defaultSlideWidth), Number(params.get("height") ?? theme.defaultSlideHeight));
  const result = await recordFileExport({
    churchId: user.churchId,
    servicePlanId: plan.id,
    kind: "SLIDE_IMAGES",
    baseFileName: `${plan.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-slides.zip`,
    ...resolution,
    write: (destination) => buildSlideZipToFile(plan, church, theme, destination, slideThemes, resolution)
  });
  const stream = Readable.toWeb(createReadStream(result.destination)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(result.size),
      "Content-Disposition": `attachment; filename="${result.fileName}"`
    }
  });
}
