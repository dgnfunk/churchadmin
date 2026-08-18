import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildItemPptx, buildSlidePng, buildTextPdf } from "@/lib/export-service";
import { PDFDocument } from "pdf-lib";
import { church, servicePlans, theme } from "@/lib/sample-data";
import { paginateServiceItem } from "@/lib/slide-pagination";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("service exports", () => {
  const item = servicePlans[0].items[0];

  it("renders every slide at 1920x1080", async () => {
    const lines = paginateServiceItem(item, theme).slides[0];
    const png = await buildSlidePng(item, lines, 0, church, theme);
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
  });

  it("creates a valid PPTX zip container", async () => {
    const pptx = await buildItemPptx(item, church, theme);
    expect(pptx.subarray(0, 2).toString()).toBe("PK");
    expect(pptx.length).toBeGreaterThan(10_000);
  });

  it("renders a configured 720p slide", async () => {
    const lines = paginateServiceItem(item, theme).slides[0];
    const png = await buildSlidePng(item, lines, 0, church, theme, { width: 1280, height: 720 });
    const metadata = await sharp(png).metadata();
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);
  });

  it("composites an image background with cover sizing", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "churchadmin-slide-"));
    const backgroundPath = path.join(directory, "background.png");
    await sharp({ create: { width: 400, height: 400, channels: 4, background: "#e11d48" } }).png().toFile(backgroundPath);
    try {
      const lines = paginateServiceItem(item, theme).slides[0];
      const png = await buildSlidePng(item, lines, 0, church, theme, {
        width: 1280, height: 720, backgroundPath,
        slideTheme: {
          id: "image-theme", churchId: church.id, name: "Image", isDefault: false,
          backgroundType: "IMAGE", backgroundColor: "#000000", overlayColor: "#000000",
          overlayOpacity: 20, textColor: "#ffffff", accentColor: "#d69e2e", layout: "CENTERED"
        }
      });
      const metadata = await sharp(png).metadata();
      expect(metadata.width).toBe(1280);
      expect(metadata.height).toBe(720);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("paginates long Unicode text into a valid PDF", async () => {
    const longBody = Array.from({ length: 180 }, (_, index) => `Canción número ${index + 1}: Señor, misericordia y corazón.`).join("\n");
    const plan = { ...servicePlans[0], items: [{ ...item, title: "Canción de adoración", body: longBody, exportTags: ["PDF" as const] }] };
    const bytes = await buildTextPdf(plan, church, theme);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
  });
});
