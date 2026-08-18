"use client";

import { Ban, CheckCircle2, Send } from "lucide-react";
import { setServiceScheduleStatusAction } from "@/lib/schedule-actions";
import { ActionForm } from "@/components/ActionForm";

export function ServiceStatusActions({ servicePlanId, status }: { servicePlanId: string; status: string }) {
  const actions = status === "DRAFT"
    ? [
        { value: "PUBLISHED", label: "Publicar servicio", icon: Send, primary: true, message: "Al publicar, las asignaciones confirmadas comenzarán a conceder permisos temporales. ¿Deseas continuar?" },
        { value: "CANCELLED", label: "Cancelar servicio", icon: Ban, primary: false, message: "¿Cancelar este servicio en borrador?" },
      ]
    : status === "PUBLISHED"
      ? [
          { value: "COMPLETED", label: "Completar", icon: CheckCircle2, primary: true, message: "Completar el servicio revocará inmediatamente los permisos temporales. ¿Deseas continuar?" },
          { value: "CANCELLED", label: "Cancelar servicio", icon: Ban, primary: false, message: "Cancelar el servicio revocará las asignaciones activas. ¿Deseas continuar?" },
        ]
      : [];

  return <div className="actions">{actions.map((action) => { const Icon = action.icon; return <ActionForm action={setServiceScheduleStatusAction} confirmMessage={action.message} key={action.value}><input name="servicePlanId" type="hidden" value={servicePlanId} /><input name="status" type="hidden" value={action.value} /><button className={action.primary ? "button primary" : "button danger"} type="submit"><Icon />{action.label}</button></ActionForm>; })}</div>;
}
