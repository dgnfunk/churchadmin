CREATE TYPE "ServicePlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ScheduleProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ServiceAssignmentKind" AS ENUM ('PRIMARY', 'BACKUP');
CREATE TYPE "ServiceAssignmentStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'REPLACED', 'COMPLETED');

ALTER TABLE "User" ADD COLUMN "personId" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServicePlan" ADD COLUMN "status" "ServicePlanStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "ServicePlan" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "ServicePlan" ADD COLUMN "completedAt" TIMESTAMP(3);
UPDATE "ServicePlan" SET "publishedAt" = "createdAt";

CREATE TABLE "MinistryRole" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#0f766e', "basePermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "servicePermissions" TEXT[] DEFAULT ARRAY[]::TEXT[], "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MinistryRole_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MinistryMembership" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "personId" TEXT NOT NULL, "ministryRoleId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MinistryMembership_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceSlotTemplate" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "name" TEXT NOT NULL, "ministryRoleId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ServiceSlotTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceSlot" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "servicePlanId" TEXT NOT NULL, "ministryRoleId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceSlot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScheduleProposal" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "serviceSlotId" TEXT NOT NULL, "personId" TEXT NOT NULL,
  "status" "ScheduleProposalStatus" NOT NULL DEFAULT 'PENDING', "notes" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleProposal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceAssignment" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "serviceSlotId" TEXT NOT NULL, "personId" TEXT NOT NULL,
  "kind" "ServiceAssignmentKind" NOT NULL, "status" "ServiceAssignmentStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "confirmedAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ServiceAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "body" TEXT NOT NULL, "href" TEXT, "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");
CREATE UNIQUE INDEX "MinistryRole_churchId_name_key" ON "MinistryRole"("churchId", "name");
CREATE INDEX "MinistryRole_churchId_isActive_sortOrder_idx" ON "MinistryRole"("churchId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "MinistryMembership_personId_ministryRoleId_key" ON "MinistryMembership"("personId", "ministryRoleId");
CREATE INDEX "MinistryMembership_churchId_isActive_idx" ON "MinistryMembership"("churchId", "isActive");
CREATE UNIQUE INDEX "ServiceSlotTemplate_churchId_name_key" ON "ServiceSlotTemplate"("churchId", "name");
CREATE INDEX "ServiceSlotTemplate_churchId_isActive_sortOrder_idx" ON "ServiceSlotTemplate"("churchId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "ServiceSlot_servicePlanId_name_key" ON "ServiceSlot"("servicePlanId", "name");
CREATE INDEX "ServiceSlot_churchId_servicePlanId_sortOrder_idx" ON "ServiceSlot"("churchId", "servicePlanId", "sortOrder");
CREATE UNIQUE INDEX "ScheduleProposal_serviceSlotId_personId_key" ON "ScheduleProposal"("serviceSlotId", "personId");
CREATE INDEX "ScheduleProposal_churchId_status_createdAt_idx" ON "ScheduleProposal"("churchId", "status", "createdAt");
CREATE INDEX "ServiceAssignment_churchId_status_idx" ON "ServiceAssignment"("churchId", "status");
CREATE INDEX "ServiceAssignment_serviceSlotId_kind_status_idx" ON "ServiceAssignment"("serviceSlotId", "kind", "status");
CREATE INDEX "ServiceAssignment_personId_status_idx" ON "ServiceAssignment"("personId", "status");
CREATE UNIQUE INDEX "ServiceAssignment_active_slot_kind_key" ON "ServiceAssignment"("serviceSlotId", "kind") WHERE "status" IN ('PENDING_CONFIRMATION', 'CONFIRMED');
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MinistryRole" ADD CONSTRAINT "MinistryRole_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MinistryMembership" ADD CONSTRAINT "MinistryMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MinistryMembership" ADD CONSTRAINT "MinistryMembership_ministryRoleId_fkey" FOREIGN KEY ("ministryRoleId") REFERENCES "MinistryRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceSlotTemplate" ADD CONSTRAINT "ServiceSlotTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceSlotTemplate" ADD CONSTRAINT "ServiceSlotTemplate_ministryRoleId_fkey" FOREIGN KEY ("ministryRoleId") REFERENCES "MinistryRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceSlot" ADD CONSTRAINT "ServiceSlot_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceSlot" ADD CONSTRAINT "ServiceSlot_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceSlot" ADD CONSTRAINT "ServiceSlot_ministryRoleId_fkey" FOREIGN KEY ("ministryRoleId") REFERENCES "MinistryRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleProposal" ADD CONSTRAINT "ScheduleProposal_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleProposal" ADD CONSTRAINT "ScheduleProposal_serviceSlotId_fkey" FOREIGN KEY ("serviceSlotId") REFERENCES "ServiceSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleProposal" ADD CONSTRAINT "ScheduleProposal_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_serviceSlotId_fkey" FOREIGN KEY ("serviceSlotId") REFERENCES "ServiceSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MinistryRole" ("id", "churchId", "name", "description", "color", "basePermissions", "servicePermissions", "sortOrder")
SELECT 'role-pastor-' || md5("id"), "id", 'Pastor', 'Pastoral leadership and attendance analytics', '#7c3aed', ARRAY['attendance.analytics.view','attendance.history.view','services.view'], ARRAY['services.view','services.content.edit'], 1 FROM "Church";
INSERT INTO "MinistryRole" ("id", "churchId", "name", "description", "color", "servicePermissions", "sortOrder")
SELECT 'role-worship-' || md5("id"), "id", 'Worship', 'Worship leaders and musicians', '#0f766e', ARRAY['services.view','services.content.edit','media.manage'], 2 FROM "Church";
INSERT INTO "MinistryRole" ("id", "churchId", "name", "description", "color", "servicePermissions", "sortOrder")
SELECT 'role-presenter-' || md5("id"), "id", 'Presenter', 'Presentation and exports', '#2563eb', ARRAY['services.view','services.present','services.export'], 3 FROM "Church";
INSERT INTO "MinistryRole" ("id", "churchId", "name", "description", "color", "servicePermissions", "sortOrder")
SELECT 'role-attendance-' || md5("id"), "id", 'Attendance', 'Manual service check-in', '#d97706', ARRAY['attendance.checkin.manual'], 4 FROM "Church";
INSERT INTO "MinistryRole" ("id", "churchId", "name", "description", "color", "servicePermissions", "sortOrder")
SELECT 'role-media-' || md5("id"), "id", 'Audio / Media', 'Audio and media operation', '#475569', ARRAY['services.view','media.manage'], 5 FROM "Church";

INSERT INTO "ServiceSlotTemplate" ("id", "churchId", "name", "ministryRoleId", "sortOrder")
SELECT 'slot-pastor-' || md5(c."id"), c."id", 'Pastor', r."id", 1 FROM "Church" c JOIN "MinistryRole" r ON r."churchId"=c."id" AND r."name"='Pastor';
INSERT INTO "ServiceSlotTemplate" ("id", "churchId", "name", "ministryRoleId", "sortOrder")
SELECT 'slot-worship-' || md5(c."id"), c."id", 'Worship leader', r."id", 2 FROM "Church" c JOIN "MinistryRole" r ON r."churchId"=c."id" AND r."name"='Worship';
INSERT INTO "ServiceSlotTemplate" ("id", "churchId", "name", "ministryRoleId", "sortOrder")
SELECT 'slot-presenter-' || md5(c."id"), c."id", 'Presenter', r."id", 3 FROM "Church" c JOIN "MinistryRole" r ON r."churchId"=c."id" AND r."name"='Presenter';
INSERT INTO "ServiceSlotTemplate" ("id", "churchId", "name", "ministryRoleId", "sortOrder")
SELECT 'slot-attendance-' || md5(c."id"), c."id", 'Attendance', r."id", 4 FROM "Church" c JOIN "MinistryRole" r ON r."churchId"=c."id" AND r."name"='Attendance';
INSERT INTO "ServiceSlotTemplate" ("id", "churchId", "name", "ministryRoleId", "sortOrder")
SELECT 'slot-media-' || md5(c."id"), c."id", 'Audio / Media', r."id", 5 FROM "Church" c JOIN "MinistryRole" r ON r."churchId"=c."id" AND r."name"='Audio / Media';

UPDATE "Person" p SET "tags" = array_append(p."tags", 'review-account-link') WHERE EXISTS (
  SELECT 1 FROM "User" u WHERE u."churchId"=p."churchId" AND lower(u."email")=p."normalizedEmail" AND
  (SELECT count(*) FROM "Person" p2 WHERE p2."churchId"=u."churchId" AND p2."normalizedEmail"=lower(u."email")) > 1
);
UPDATE "User" u SET "personId" = (
  SELECT min(p."id") FROM "Person" p WHERE p."churchId"=u."churchId" AND p."normalizedEmail"=lower(u."email")
) WHERE u."role"='VOLUNTEER' AND (SELECT count(*) FROM "Person" p WHERE p."churchId"=u."churchId" AND p."normalizedEmail"=lower(u."email"))=1;
INSERT INTO "Person" ("id", "churchId", "personType", "status", "firstName", "lastName", "email", "normalizedEmail", "tags", "createdAt", "updatedAt")
SELECT 'person-user-' || md5(u."id"), u."churchId", 'MEMBER', 'ACTIVE', split_part(u."name", ' ', 1),
  CASE WHEN position(' ' in u."name") > 0 THEN substring(u."name" from position(' ' in u."name") + 1) ELSE 'Member' END,
  u."email", lower(u."email"), ARRAY['created-from-user'], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u WHERE u."role"='VOLUNTEER' AND u."personId" IS NULL AND NOT EXISTS (
  SELECT 1 FROM "Person" p WHERE p."churchId"=u."churchId" AND p."normalizedEmail"=lower(u."email")
);
UPDATE "User" u SET "personId"='person-user-' || md5(u."id") WHERE u."role"='VOLUNTEER' AND u."personId" IS NULL AND EXISTS (SELECT 1 FROM "Person" p WHERE p."id"='person-user-' || md5(u."id"));

INSERT INTO "MinistryRole" ("id", "churchId", "name", "description", "color", "basePermissions", "servicePermissions", "sortOrder")
SELECT 'role-imported-' || md5(u."id"), u."churchId", 'Imported access - ' || u."name", 'Permissions migrated from the previous volunteer account', '#64748b',
  (CASE WHEN 'attendance'=ANY(u."scopes") THEN ARRAY['attendance.checkin.manual','attendance.sessions.manage','attendance.history.view','people.view','people.manage'] ELSE ARRAY[]::TEXT[] END) ||
  (CASE WHEN 'services'=ANY(u."scopes") THEN ARRAY['services.view','services.content.edit','services.present','services.export','media.manage'] ELSE ARRAY[]::TEXT[] END) ||
  (CASE WHEN 'theme'=ANY(u."scopes") THEN ARRAY['theme.manage'] ELSE ARRAY[]::TEXT[] END) ||
  (CASE WHEN 'users'=ANY(u."scopes") THEN ARRAY['users.manage','ministry.manage','schedule.manage'] ELSE ARRAY[]::TEXT[] END), ARRAY[]::TEXT[], 90
FROM "User" u WHERE u."role"='VOLUNTEER' AND u."personId" IS NOT NULL;
INSERT INTO "MinistryMembership" ("id", "churchId", "personId", "ministryRoleId")
SELECT 'membership-imported-' || md5(u."id"), u."churchId", u."personId", 'role-imported-' || md5(u."id")
FROM "User" u WHERE u."role"='VOLUNTEER' AND u."personId" IS NOT NULL;

UPDATE "User" SET "role"='MEMBER' WHERE "role"='VOLUNTEER';
ALTER TABLE "User" DROP COLUMN "scopes";
