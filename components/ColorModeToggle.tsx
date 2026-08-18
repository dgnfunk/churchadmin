"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useAppState } from "@/components/AppStateProvider";
import type { ThemeMode } from "@/lib/domain";

const storageKey = "churchadmin-color-mode";
const modeChangeEvent = "churchadmin-color-mode-change";

function applyMode(mode: ThemeMode) {
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.style.colorScheme = mode;
}

export function ColorModeToggle() {
  const { theme } = useAppState();
  const mode = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(modeChangeEvent, onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(modeChangeEvent, onStoreChange);
      };
    },
    () => {
      const saved = window.localStorage.getItem(storageKey);
      return saved === "light" || saved === "dark" ? saved : theme.mode;
    },
    () => theme.mode,
  );

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    window.localStorage.setItem(storageKey, next);
    applyMode(next);
    window.dispatchEvent(new Event(modeChangeEvent));
  }

  const dark = mode === "dark";
  return <button aria-label={dark ? "Desactivar modo nocturno" : "Activar modo nocturno"} aria-pressed={dark} className="color-mode-toggle" onClick={toggle} title={dark ? "Usar modo claro" : "Usar modo nocturno"} type="button">
    <span className="color-mode-icon">{dark ? <Moon /> : <Sun />}</span>
    <span><strong>Modo nocturno</strong><small>{dark ? "Activado" : "Desactivado"}</small></span>
    <span aria-hidden="true" className="toggle-track"><i /></span>
  </button>;
}
