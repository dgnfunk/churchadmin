-- CreateEnum
CREATE TYPE "SlideBackgroundType" AS ENUM ('COLOR', 'IMAGE');

-- CreateEnum
CREATE TYPE "SlideThemeLayout" AS ENUM ('CENTERED', 'LOWER_THIRD');

-- AlterTable
ALTER TABLE "ThemeSettings"
  ADD COLUMN "defaultSlideWidth" INTEGER NOT NULL DEFAULT 1920,
  ADD COLUMN "defaultSlideHeight" INTEGER NOT NULL DEFAULT 1080;

ALTER TABLE "MediaAsset" ALTER COLUMN "serviceItemId" DROP NOT NULL;

ALTER TABLE "ServicePlan" ADD COLUMN "slideThemeId" TEXT;
ALTER TABLE "ServiceItem" ADD COLUMN "slideThemeId" TEXT;

ALTER TABLE "ExportJob"
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "renderOptions" JSONB;

-- CreateTable
CREATE TABLE "SlideTheme" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "backgroundType" "SlideBackgroundType" NOT NULL DEFAULT 'COLOR',
  "backgroundColor" TEXT NOT NULL DEFAULT '#0f766e',
  "backgroundAssetId" TEXT,
  "overlayColor" TEXT NOT NULL DEFAULT '#102421',
  "overlayOpacity" INTEGER NOT NULL DEFAULT 36,
  "textColor" TEXT NOT NULL DEFAULT '#ffffff',
  "accentColor" TEXT NOT NULL DEFAULT '#d69e2e',
  "layout" "SlideThemeLayout" NOT NULL DEFAULT 'CENTERED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlideTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlideTheme_churchId_name_key" ON "SlideTheme"("churchId", "name");
CREATE INDEX "SlideTheme_churchId_isDefault_idx" ON "SlideTheme"("churchId", "isDefault");
CREATE UNIQUE INDEX "SlideTheme_one_default_per_church" ON "SlideTheme"("churchId") WHERE "isDefault" = true;

ALTER TABLE "SlideTheme" ADD CONSTRAINT "SlideTheme_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlideTheme" ADD CONSTRAINT "SlideTheme_backgroundAssetId_fkey" FOREIGN KEY ("backgroundAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_slideThemeId_fkey" FOREIGN KEY ("slideThemeId") REFERENCES "SlideTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_slideThemeId_fkey" FOREIGN KEY ("slideThemeId") REFERENCES "SlideTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SlideTheme" (
  "id", "churchId", "name", "isDefault", "backgroundType", "backgroundColor",
  "overlayColor", "overlayOpacity", "textColor", "accentColor", "layout", "updatedAt"
)
SELECT
  'default-' || md5(t."churchId"), t."churchId", 'Church Default', true, 'COLOR', t."primaryColor",
  '#102421', 36, '#ffffff', t."accentColor",
  CASE WHEN t."slideTemplate" = 'lower-third' THEN 'LOWER_THIRD'::"SlideThemeLayout" ELSE 'CENTERED'::"SlideThemeLayout" END,
  CURRENT_TIMESTAMP
FROM "ThemeSettings" t;
