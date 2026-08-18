import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppStateProvider";
import { getInitialAppState } from "@/lib/app-state";
import { getCurrentUser } from "@/lib/auth";
import { themeToCssVariables } from "@/lib/theme";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "ChurchAdmin",
  description: "Administración, asistencia y planificación de servicios",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Church Check-in" },
  icons: {
    icon: "/api/pwa/icon?size=192",
    apple: "/api/pwa/icon?size=192"
  }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0f766e" };

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  const initialState = await getInitialAppState(currentUser?.churchId, currentUser);

  return (
    <html
      data-color-mode={initialState.theme.mode}
      lang="es-MX"
      style={themeToCssVariables(initialState.theme) as React.CSSProperties}
      suppressHydrationWarning
    >
      <head><script dangerouslySetInnerHTML={{ __html: `try{const m=localStorage.getItem("churchadmin-color-mode");if(m==="light"||m==="dark"){document.documentElement.dataset.colorMode=m;document.documentElement.style.colorScheme=m}}catch{}` }} /></head>
      <body>
        <AppStateProvider initialState={initialState}>
          <PwaRegister />
          <AppShell currentUser={currentUser}>{children}</AppShell>
        </AppStateProvider>
      </body>
    </html>
  );
}
