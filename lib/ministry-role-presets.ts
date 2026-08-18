import type { Permission } from "@/lib/domain";

export type MinistryRolePresetKey = "treasury" | "offering-auditor";

export const ministryRolePresets: Record<MinistryRolePresetKey, { name: string; description: string; color: string; basePermissions: Permission[] }> = {
  treasury: {
    name: "Tesorería",
    description: "Captura ofrendas y consulta únicamente sus registros del mes actual.",
    color: "#0f766e",
    basePermissions: ["offerings.capture"],
  },
  "offering-auditor": {
    name: "Auditor de ofrendas",
    description: "Consulta historial, tendencias, exportaciones y eventos de auditoría sin modificar cierres.",
    color: "#7c3aed",
    basePermissions: ["offerings.audit.view"],
  },
};

export function ministryRolePreset(value: string) {
  return value === "treasury" || value === "offering-auditor" ? ministryRolePresets[value] : null;
}
