import sharp from "sharp";
import { mediaFilePath } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("size"));
  const size = requested === 512 ? 512 : 192;
  const church = await prisma.church.findUnique({
    where: { slug: process.env.CHURCH_SLUG ?? "grace-community" },
    include: { theme: true, logoAsset: { select: { storageKey: true } } }
  });
  const primary = church?.theme?.primaryColor ?? "#0f766e";
  const initials = (church?.name ?? "ChurchAdmin").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CA";
  const base = sharp({ create: { width: size, height: size, channels: 4, background: primary } });
  let image: Buffer;
  if (church?.logoAsset) {
    const logo = await sharp(mediaFilePath(church.logoAsset.storageKey)).resize(Math.round(size * 0.64), Math.round(size * 0.64), { fit: "contain" }).png().toBuffer();
    image = await base.composite([{ input: logo, gravity: "centre" }]).png().toBuffer();
  } else {
    const fontSize = Math.round(size * 0.34);
    const svg = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="${fontSize}" font-weight="700" fill="#ffffff">${initials.replace(/[^A-Z0-9]/g, "")}</text></svg>`);
    image = await base.composite([{ input: svg }]).png().toBuffer();
  }
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
}
