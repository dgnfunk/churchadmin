ALTER TABLE "Church" ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'MXN';

CREATE TYPE "OfferingAuditEventType" AS ENUM ('CONFIRMED', 'CORRECTED');

CREATE TABLE "OfferingClosure" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "servicePlanId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "note" TEXT,
  "confirmedById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfferingClosure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferingAuditEvent" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "offeringClosureId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "eventType" "OfferingAuditEventType" NOT NULL,
  "previousAmountMinor" BIGINT,
  "newAmountMinor" BIGINT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfferingAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfferingClosure_servicePlanId_key" ON "OfferingClosure"("servicePlanId");
CREATE INDEX "OfferingClosure_churchId_confirmedAt_idx" ON "OfferingClosure"("churchId", "confirmedAt");
CREATE INDEX "OfferingAuditEvent_churchId_createdAt_idx" ON "OfferingAuditEvent"("churchId", "createdAt");
CREATE INDEX "OfferingAuditEvent_offeringClosureId_createdAt_idx" ON "OfferingAuditEvent"("offeringClosureId", "createdAt");

ALTER TABLE "OfferingClosure" ADD CONSTRAINT "OfferingClosure_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferingClosure" ADD CONSTRAINT "OfferingClosure_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfferingClosure" ADD CONSTRAINT "OfferingClosure_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfferingAuditEvent" ADD CONSTRAINT "OfferingAuditEvent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferingAuditEvent" ADD CONSTRAINT "OfferingAuditEvent_offeringClosureId_fkey" FOREIGN KEY ("offeringClosureId") REFERENCES "OfferingClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferingAuditEvent" ADD CONSTRAINT "OfferingAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
