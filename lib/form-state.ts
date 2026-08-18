export type FormFieldErrors = Record<string, string>;

export type FormActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FormFieldErrors;
  href?: string;
  hrefLabel?: string;
};

export const initialFormState: FormActionState = { status: "idle" };

export function formError(message: string, fieldErrors?: FormFieldErrors, link?: { href: string; label: string }): FormActionState {
  return { status: "error", message, fieldErrors, href: link?.href, hrefLabel: link?.label };
}

export function formSuccess(message: string): FormActionState {
  return { status: "success", message };
}

export function isFormActionState(value: unknown): value is FormActionState {
  return Boolean(value && typeof value === "object" && ["idle", "success", "error"].includes(String((value as FormActionState).status)));
}
