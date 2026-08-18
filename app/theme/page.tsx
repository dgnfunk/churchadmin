import { ThemeSettingsClient } from "@/components/ThemeSettingsClient";
import { requireScope } from "@/lib/auth";

export default async function ThemePage() {
  await requireScope("theme");
  return <ThemeSettingsClient />;
}
