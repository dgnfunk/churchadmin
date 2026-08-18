import type { MediaAssetRole, ServiceItemType } from "@prisma/client";
import type { ExportTag, ServicePlan } from "@/lib/domain";
import { stringList } from "@/lib/database-compat";

export type ServicePlanRow = {
  id: string;
  churchId: string;
  title: string;
  topic: string | null;
  serviceAt: Date;
  status: "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";
  slideThemeId: string | null;
  items: Array<{
    id: string;
    servicePlanId: string;
    type: ServiceItemType;
    title: string;
    body: string;
    notes: string | null;
    durationMinutes: number | null;
    sortOrder: number;
    exportTags: unknown;
    slideThemeId: string | null;
    mediaAssets: Array<{
      id: string;
      churchId: string;
      serviceItemId: string | null;
      role: MediaAssetRole;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      checksum: string;
    }>;
  }>;
};

export const servicePlanInclude = {
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: { mediaAssets: { orderBy: { createdAt: "asc" as const } } }
  }
};

export function serializeServicePlan(plan: ServicePlanRow): ServicePlan {
  return {
    id: plan.id,
    churchId: plan.churchId,
    title: plan.title,
    topic: plan.topic ?? undefined,
    serviceAt: plan.serviceAt.toISOString(),
    status: plan.status,
    slideThemeId: plan.slideThemeId ?? undefined,
    items: plan.items.map((item) => ({
      id: item.id,
      servicePlanId: item.servicePlanId,
      type: item.type,
      title: item.title,
      body: item.body,
      notes: item.notes ?? undefined,
      durationMinutes: item.durationMinutes ?? undefined,
      sortOrder: item.sortOrder,
      exportTags: stringList(item.exportTags) as ExportTag[],
      slideThemeId: item.slideThemeId ?? undefined,
      mediaAssets: item.mediaAssets.map((asset) => ({
        id: asset.id,
        churchId: asset.churchId,
        serviceItemId: asset.serviceItemId ?? undefined,
        role: asset.role,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        sizeBytes: Number(asset.sizeBytes),
        checksum: asset.checksum
      }))
    }))
  };
}
