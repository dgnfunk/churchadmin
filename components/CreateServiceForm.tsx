"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { initialFormState } from "@/lib/form-state";
import { createScheduledServiceAction } from "@/lib/schedule-actions";

export function CreateServiceForm({ defaultDate }: { defaultDate: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createScheduledServiceAction, initialFormState);
  const error = (field: string) => state.fieldErrors?.[field];

  useEffect(() => {
    if (state.status === "error") formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return <form action={formAction} aria-busy={pending} className="creation-band service-creator" id="nuevo-servicio" ref={formRef}>
    <div><span className="eyebrow">Nuevo servicio</span><h2>Prepara la siguiente reunión</h2><p>Comienza vacío, usa los puestos habituales o duplica el servicio anterior.</p></div>
    <div className="creation-fields">
      <label>Nombre<input aria-describedby={error("title") ? "service-title-error" : undefined} aria-invalid={Boolean(error("title"))} defaultValue="Servicio dominical" maxLength={120} minLength={2} name="title" required />{error("title") ? <small className="field-error" id="service-title-error">{error("title")}</small> : null}</label>
      <label>Preparación<select defaultValue="template" name="creationMode"><option value="template">Usar plantillas de puestos</option><option value="duplicate">Duplicar servicio anterior</option><option value="blank">Comenzar vacío</option></select></label>
      <label>Fecha<input aria-describedby={error("date") ? "service-date-error" : undefined} aria-invalid={Boolean(error("date"))} defaultValue={defaultDate} name="date" required type="date" />{error("date") ? <small className="field-error" id="service-date-error">{error("date")}</small> : null}</label>
      <label>Hora<input aria-describedby={error("time") ? "service-time-error" : undefined} aria-invalid={Boolean(error("time"))} defaultValue="10:00" name="time" required type="time" />{error("time") ? <small className="field-error" id="service-time-error">{error("time")}</small> : null}</label>
      <button className="button primary" disabled={pending}><Plus />{pending ? "Creando…" : "Crear y abrir"}</button>
    </div>
    {state.status === "error" && state.message ? <div aria-live="assertive" className="form-message error" role="alert"><span>{state.message}</span>{state.href ? <Link href={state.href}>{state.hrefLabel ?? "Abrir servicio"}</Link> : null}</div> : null}
  </form>;
}
