import type { ExportTag, ServiceItem, ServicePlan } from "./domain";

export function orderedItems(plan: ServicePlan): ServiceItem[] {
  return [...plan.items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function itemsForExport(plan: ServicePlan, tag: ExportTag): ServiceItem[] {
  return orderedItems(plan).filter((item) => item.exportTags.includes(tag));
}

export function duplicateServicePlan(plan: ServicePlan, nextId: string, serviceAt: string): ServicePlan {
  return {
    ...plan,
    id: nextId,
    title: `${plan.title} Copy`,
    serviceAt,
    items: orderedItems(plan).map((item, index) => ({
      ...item,
      id: `${nextId}-item-${index + 1}`,
      servicePlanId: nextId,
      sortOrder: index + 1
    }))
  };
}
