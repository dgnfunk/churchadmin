CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "SlideFontFamily" AS ENUM ('INTER', 'ARIAL', 'GEORGIA');
CREATE TYPE "SlideLogoPlacement" AS ENUM ('NONE', 'TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT');

ALTER TYPE "ExportStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "ExportStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Church"
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Monterrey',
  ADD COLUMN "logoAssetId" TEXT;

ALTER TABLE "Person"
  ADD COLUMN "normalizedEmail" TEXT,
  ADD COLUMN "normalizedPhone" TEXT;

UPDATE "Person"
SET "normalizedEmail" = NULLIF(lower(trim("email")), ''),
    "normalizedPhone" = NULLIF(regexp_replace(coalesce("phone", ''), '[^0-9]+', '', 'g'), '');

ALTER TABLE "AttendanceSession"
  ADD COLUMN "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3);

UPDATE "AttendanceSession"
SET "qrToken" = md5(random()::text || clock_timestamp()::text || "id") || md5("id" || random()::text),
    "expiresAt" = "serviceAt" + interval '12 hours',
    "status" = CASE WHEN "serviceAt" + interval '12 hours' < now() THEN 'CLOSED'::"AttendanceSessionStatus" ELSE 'OPEN'::"AttendanceSessionStatus" END,
    "closedAt" = CASE WHEN "serviceAt" + interval '12 hours' < now() THEN "serviceAt" + interval '12 hours' ELSE NULL END;

ALTER TABLE "SlideTheme"
  ADD COLUMN "fontFamily" "SlideFontFamily" NOT NULL DEFAULT 'INTER',
  ADD COLUMN "titleFontSize" INTEGER NOT NULL DEFAULT 82,
  ADD COLUMN "bodyFontSize" INTEGER NOT NULL DEFAULT 46,
  ADD COLUMN "fontWeight" INTEGER NOT NULL DEFAULT 700,
  ADD COLUMN "safeMargin" INTEGER NOT NULL DEFAULT 96,
  ADD COLUMN "logoPlacement" "SlideLogoPlacement" NOT NULL DEFAULT 'TOP_LEFT';

ALTER TABLE "ExportJob"
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "cancelRequested" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RateLimitBucket" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentLibraryItem" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "type" "ServiceItemType" NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "notes" TEXT,
  "exportTags" "ExportTag"[] DEFAULT ARRAY[]::"ExportTag"[],
  "lastUsedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UploadSession" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "offsetBytes" BIGINT NOT NULL DEFAULT 0,
  "storageKey" TEXT NOT NULL,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Person_churchId_normalizedEmail_idx" ON "Person"("churchId", "normalizedEmail");
CREATE INDEX "Person_churchId_normalizedPhone_idx" ON "Person"("churchId", "normalizedPhone");
CREATE UNIQUE INDEX "RateLimitBucket_action_keyHash_windowStart_key" ON "RateLimitBucket"("action", "keyHash", "windowStart");
CREATE INDEX "RateLimitBucket_churchId_expiresAt_idx" ON "RateLimitBucket"("churchId", "expiresAt");
CREATE UNIQUE INDEX "ContentLibraryItem_churchId_type_normalizedTitle_key" ON "ContentLibraryItem"("churchId", "type", "normalizedTitle");
CREATE INDEX "ContentLibraryItem_churchId_archivedAt_title_idx" ON "ContentLibraryItem"("churchId", "archivedAt", "title");
CREATE INDEX "UploadSession_churchId_expiresAt_idx" ON "UploadSession"("churchId", "expiresAt");

ALTER TABLE "Church" ADD CONSTRAINT "Church_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RateLimitBucket" ADD CONSTRAINT "RateLimitBucket_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentLibraryItem" ADD CONSTRAINT "ContentLibraryItem_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
