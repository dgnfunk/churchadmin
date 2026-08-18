import type { FormFieldErrors } from "@/lib/form-state";

export type ServiceCreationMode = "blank" | "duplicate" | "template";

export type ScheduledServiceDraft = {
  title: string;
  date: string;
  time: string;
  creationMode: ServiceCreationMode;
};

export function validateScheduledServiceDraft(input: Record<string, string>): { data?: ScheduledServiceDraft; fieldErrors?: FormFieldErrors } {
  const title = input.title?.trim() ?? "";
  const date = input.date ?? "";
  const time = input.time ?? "";
  const fieldErrors: FormFieldErrors = {};

  if (title.length < 2) fieldErrors.title = "El nombre debe tener al menos 2 caracteres.";
  else if (title.length > 120) fieldErrors.title = "El nombre no puede exceder 120 caracteres.";

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) fieldErrors.date = "Selecciona una fecha válida.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fieldErrors.time = "Selecciona una hora válida.";

  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const creationMode = input.creationMode === "blank" || input.creationMode === "duplicate" ? input.creationMode : "template";
  return { data: { title, date, time, creationMode } };
}
