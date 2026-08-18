import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const church = await prisma.church.findUnique({
    where: { slug: process.env.CHURCH_SLUG ?? "grace-community" }, include: { theme: true }
  });
  const name = church?.name ?? "ChurchAdmin";
  return {
    name: `${name} Check-in`, short_name: name.slice(0, 24),
    description: "Mobile service attendance check-in", start_url: "/welcome", scope: "/",
    display: "standalone", orientation: "portrait-primary",
    background_color: church?.theme?.mode === "dark" ? "#102421" : "#f6f8f7",
    theme_color: church?.theme?.primaryColor ?? "#0f766e",
    icons: [
      { src: "/api/pwa/icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/pwa/icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
