ALTER TABLE "AttendanceSession" ADD COLUMN "manualCode" TEXT;

UPDATE "AttendanceSession"
SET "manualCode" = upper(substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 4) || '-' || substr(md5("id" || random()::text), 1, 4));

ALTER TABLE "AttendanceSession" ALTER COLUMN "manualCode" SET NOT NULL;

CREATE UNIQUE INDEX "AttendanceSession_manualCode_key" ON "AttendanceSession"("manualCode");
