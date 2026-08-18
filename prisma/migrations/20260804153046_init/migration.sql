-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('MEMBER', 'VISITOR');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'QR');

-- CreateEnum
CREATE TYPE "ServiceItemType" AS ENUM ('SONG', 'SCRIPTURE', 'ANNOUNCEMENT', 'SERMON_NOTE', 'PRAYER', 'MEDIA_CUE', 'CUSTOM_TEXT');

-- CreateEnum
CREATE TYPE "ExportTag" AS ENUM ('SLIDE', 'PDF', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ExportKind" AS ENUM ('SLIDE_IMAGES', 'TEXT_PDF', 'RUN_SHEET_PDF');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "Church" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeSettings" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "accentColor" TEXT NOT NULL DEFAULT '#d69e2e',
    "mode" TEXT NOT NULL DEFAULT 'light',
    "logoUrl" TEXT,
    "headingStyle" TEXT NOT NULL DEFAULT 'classic',
    "exportHeader" TEXT NOT NULL DEFAULT 'branded',
    "slideTemplate" TEXT NOT NULL DEFAULT 'centered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VOLUNTEER',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "personType" "PersonType" NOT NULL,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "familyNotes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceAt" TIMESTAMP(3) NOT NULL,
    "qrToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePlan" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "serviceAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "servicePlanId" TEXT NOT NULL,
    "type" "ServiceItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "notes" TEXT,
    "durationMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "exportTags" "ExportTag"[] DEFAULT ARRAY[]::"ExportTag"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "servicePlanId" TEXT,
    "kind" "ExportKind" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Church_slug_key" ON "Church"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeSettings_churchId_key" ON "ThemeSettings"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_churchId_email_key" ON "User"("churchId", "email");

-- CreateIndex
CREATE INDEX "Person_churchId_personType_idx" ON "Person"("churchId", "personType");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_qrToken_key" ON "AttendanceSession"("qrToken");

-- CreateIndex
CREATE INDEX "AttendanceSession_churchId_serviceAt_idx" ON "AttendanceSession"("churchId", "serviceAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_personId_key" ON "AttendanceRecord"("sessionId", "personId");

-- CreateIndex
CREATE INDEX "ServicePlan_churchId_serviceAt_idx" ON "ServicePlan"("churchId", "serviceAt");

-- CreateIndex
CREATE INDEX "ServiceItem_servicePlanId_sortOrder_idx" ON "ServiceItem"("servicePlanId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ThemeSettings" ADD CONSTRAINT "ThemeSettings_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
