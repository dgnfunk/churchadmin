ALTER TABLE "ThemeSettings"
ADD COLUMN "songLinesPerSlide" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "textLinesPerSlide" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN "maxCharactersPerSlide" INTEGER NOT NULL DEFAULT 180;

ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AttendanceSession" ADD COLUMN "servicePlanId" TEXT;
CREATE UNIQUE INDEX "AttendanceSession_servicePlanId_key" ON "AttendanceSession"("servicePlanId");
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_servicePlanId_fkey"
FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "MediaAssetRole" AS ENUM ('PRIMARY', 'BACKGROUND', 'AUDIO', 'REFERENCE');
CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "serviceItemId" TEXT NOT NULL,
  "role" "MediaAssetRole" NOT NULL DEFAULT 'PRIMARY',
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE INDEX "MediaAsset_churchId_serviceItemId_idx" ON "MediaAsset"("churchId", "serviceItemId");
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_churchId_fkey"
FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_serviceItemId_fkey"
FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "ExportKind" ADD VALUE 'PROPRESENTER_PACKAGE';
ALTER TABLE "ExportJob"
ADD COLUMN "fileName" TEXT,
ADD COLUMN "sizeBytes" BIGINT,
ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_servicePlanId_fkey"
FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
