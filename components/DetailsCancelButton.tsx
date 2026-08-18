"use client";

import { X } from "lucide-react";
import type { MouseEvent } from "react";

export function DetailsCancelButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const closeEditor = (event: MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.closest("form");
    const details = event.currentTarget.closest("details");

    form?.reset();
    if (details) {
      details.open = false;
      const summary = details.firstElementChild;
      if (summary instanceof HTMLElement) summary.focus();
    }
  };

  return iconOnly ? (
    <button aria-label="Cancelar y cerrar" className="icon-button" onClick={closeEditor} type="button">
      <X />
    </button>
  ) : (
    <button className="button" onClick={closeEditor} type="button">Cancelar</button>
  );
}
