import type { ThemeSettings } from "./domain";

export function themeToCssVariables(theme: ThemeSettings): Record<string, string> {
  const foreground = theme.mode === "dark" ? "#f8fafc" : "#172126";
  const background = theme.mode === "dark" ? "#101820" : "#ffffff";
  const surface = theme.mode === "dark" ? "#16232b" : "#f7f9f8";
  const border = theme.mode === "dark" ? "#263842" : "#dfe7e3";

  return {
    "--church-primary": theme.primaryColor,
    "--church-accent": theme.accentColor,
    "--church-background": background,
    "--church-surface": surface,
    "--church-foreground": foreground,
    "--church-muted": theme.mode === "dark" ? "#9fb2ad" : "#60706a",
    "--church-border": border
  };
}

export function inlineThemeStyle(theme: ThemeSettings): string {
  return Object.entries(themeToCssVariables(theme))
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}
