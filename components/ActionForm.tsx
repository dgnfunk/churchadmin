"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import type { FormHTMLAttributes, ReactNode } from "react";
import { initialFormState, isFormActionState, type FormActionState } from "@/lib/form-state";

type ActionFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => Promise<unknown>;
  children: ReactNode;
  confirmMessage?: string;
  successMessage?: string;
};

function readableActionError(error: unknown) {
  if (error instanceof Error && error.message && !error.message.includes("Server Components render")) return error.message;
  return "No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.";
}

export function ActionForm({ action, children, className, confirmMessage, successMessage, ...props }: ActionFormProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(async (_previous, formData) => {
    try {
      const result = await action(formData);
      return isFormActionState(result) ? result : { status: "success", message: successMessage };
    } catch (error) {
      return { status: "error", message: readableActionError(error) };
    }
  }, initialFormState);

  useEffect(() => {
    if (state.status === "error") messageRef.current?.focus();
  }, [state]);

  return <form {...props} action={formAction} aria-busy={pending} className={className} onSubmit={(event) => {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  }}>
    {children}
    {state.status !== "idle" && state.message ? <div aria-live="polite" className={`form-message ${state.status}`} ref={messageRef} role={state.status === "error" ? "alert" : "status"} tabIndex={-1}>
      <span>{state.message}</span>
      {state.href ? <Link href={state.href}>{state.hrefLabel ?? "Abrir"}</Link> : null}
    </div> : null}
  </form>;
}
