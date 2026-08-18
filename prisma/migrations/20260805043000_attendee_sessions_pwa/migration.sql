ALTER TABLE "Church" ADD COLUMN "defaultPhoneRegion" TEXT NOT NULL DEFAULT 'MX';

CREATE TABLE "AttendeeSession" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendeeSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendeeSession_tokenHash_key" ON "AttendeeSession"("tokenHash");
CREATE INDEX "AttendeeSession_churchId_expiresAt_idx" ON "AttendeeSession"("churchId", "expiresAt");
CREATE INDEX "AttendeeSession_personId_idx" ON "AttendeeSession"("personId");
ALTER TABLE "AttendeeSession" ADD CONSTRAINT "AttendeeSession_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendeeSession" ADD CONSTRAINT "AttendeeSession_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Person"
SET "normalizedEmail" = NULLIF(lower(trim("email")), ''),
    "normalizedPhone" = CASE
      WHEN length(regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g')) = 10
        THEN '52' || regexp_replace("phone", '[^0-9]', '', 'g')
      ELSE NULLIF(regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g'), '')
    END;

WITH duplicate_people AS (
  SELECT p."id"
  FROM "Person" p
  WHERE (p."normalizedEmail" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "Person" other
    WHERE other."churchId" = p."churchId" AND other."normalizedEmail" = p."normalizedEmail" AND other."id" <> p."id"
  )) OR (p."normalizedPhone" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "Person" other
    WHERE other."churchId" = p."churchId" AND other."normalizedPhone" = p."normalizedPhone" AND other."id" <> p."id"
  ))
)
UPDATE "Person" p
SET "tags" = array_append(p."tags", 'review-duplicate-contact')
FROM duplicate_people d
WHERE p."id" = d."id" AND NOT ('review-duplicate-contact' = ANY(p."tags"));
