CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'FACEBOOK', 'INSTAGRAM');
CREATE TYPE "SocialProvider" AS ENUM ('WHATSAPP', 'FACEBOOK', 'INSTAGRAM');
CREATE TYPE "SocialConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'EXPIRED', 'ERROR', 'SUSPENDED');
CREATE TYPE "CommunicationConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'PENDING');
CREATE TYPE "CommunicationTemplateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');
CREATE TYPE "CommunicationTemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
CREATE TYPE "CommunicationApprovalMode" AS ENUM ('AUTOMATIC', 'REQUIRED');
CREATE TYPE "CommunicationCampaignStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'SCHEDULED', 'PROCESSING', 'PARTIAL', 'COMPLETE', 'FAILED', 'CANCELLED');
CREATE TYPE "CampaignDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "WhatsAppGroupCapabilityStatus" AS ENUM ('NOT_CHECKED', 'INELIGIBLE', 'ELIGIBLE', 'CONNECTED', 'SUSPENDED');

CREATE TABLE "SocialConnection" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "provider" "SocialProvider" NOT NULL,
  "externalAccountId" TEXT NOT NULL, "displayName" TEXT NOT NULL, "encryptedCredentials" TEXT,
  "metadata" JSONB, "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "SocialConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED', "expiresAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3), "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationConsent" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "personId" TEXT NOT NULL,
  "channel" "CommunicationChannel" NOT NULL, "normalizedRecipient" TEXT NOT NULL,
  "status" "CommunicationConsentStatus" NOT NULL DEFAULT 'PENDING', "source" TEXT NOT NULL,
  "evidence" TEXT, "optedInAt" TIMESTAMP(3), "optedOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationAudience" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "criteria" JSONB NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationTemplate" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "channels" "CommunicationChannel"[] DEFAULT ARRAY[]::"CommunicationChannel"[], "language" TEXT NOT NULL DEFAULT 'es_MX',
  "category" "CommunicationTemplateCategory" NOT NULL DEFAULT 'MARKETING',
  "status" "CommunicationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "approvalMode" "CommunicationApprovalMode" NOT NULL DEFAULT 'REQUIRED', "content" JSONB NOT NULL,
  "defaultSchedule" JSONB, "remoteTemplateId" TEXT, "remoteTemplateName" TEXT,
  "rejectionReason" TEXT, "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationCampaign" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "servicePlanId" TEXT, "templateId" TEXT,
  "audienceId" TEXT, "createdByUserId" TEXT NOT NULL, "title" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL,
  "youtubeVideoId" TEXT NOT NULL, "youtubeTitle" TEXT NOT NULL, "youtubeDescription" TEXT,
  "youtubeChannel" TEXT, "youtubeThumbnailUrl" TEXT, "content" JSONB NOT NULL,
  "status" "CommunicationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "approvalMode" "CommunicationApprovalMode" NOT NULL DEFAULT 'REQUIRED', "scheduledAt" TIMESTAMP(3),
  "relativeDayOffset" INTEGER, "relativeLocalTime" TEXT, "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedVersion" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CommunicationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignDelivery" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "campaignId" TEXT NOT NULL,
  "channel" "CommunicationChannel" NOT NULL, "connectionId" TEXT, "personId" TEXT,
  "recipientKey" TEXT NOT NULL, "recipientName" TEXT, "content" JSONB NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL, "status" "CampaignDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0, "lockedAt" TIMESTAMP(3), "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3), "readAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3),
  "externalMessageId" TEXT, "externalPostUrl" TEXT, "errorCode" TEXT, "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignApproval" (
  "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "approvedById" TEXT NOT NULL,
  "contentVersion" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationAuditEvent" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL, "campaignId" TEXT, "actorUserId" TEXT,
  "eventType" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL, "churchId" TEXT, "provider" "SocialProvider" NOT NULL,
  "externalId" TEXT NOT NULL, "payloadHash" TEXT NOT NULL, "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppGroupCapability" (
  "id" TEXT NOT NULL, "churchId" TEXT NOT NULL,
  "status" "WhatsAppGroupCapabilityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
  "checkedAt" TIMESTAMP(3), "metadata" JSONB, "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppGroupCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConnection_churchId_provider_externalAccountId_key" ON "SocialConnection"("churchId", "provider", "externalAccountId");
CREATE INDEX "SocialConnection_churchId_provider_status_idx" ON "SocialConnection"("churchId", "provider", "status");
CREATE UNIQUE INDEX "CommunicationConsent_churchId_personId_channel_key" ON "CommunicationConsent"("churchId", "personId", "channel");
CREATE INDEX "CommunicationConsent_churchId_channel_status_idx" ON "CommunicationConsent"("churchId", "channel", "status");
CREATE INDEX "CommunicationConsent_churchId_normalizedRecipient_idx" ON "CommunicationConsent"("churchId", "normalizedRecipient");
CREATE UNIQUE INDEX "CommunicationAudience_churchId_name_key" ON "CommunicationAudience"("churchId", "name");
CREATE INDEX "CommunicationAudience_churchId_isActive_idx" ON "CommunicationAudience"("churchId", "isActive");
CREATE UNIQUE INDEX "CommunicationTemplate_churchId_name_key" ON "CommunicationTemplate"("churchId", "name");
CREATE INDEX "CommunicationTemplate_churchId_status_idx" ON "CommunicationTemplate"("churchId", "status");
CREATE INDEX "CommunicationCampaign_churchId_status_scheduledAt_idx" ON "CommunicationCampaign"("churchId", "status", "scheduledAt");
CREATE INDEX "CommunicationCampaign_servicePlanId_idx" ON "CommunicationCampaign"("servicePlanId");
CREATE UNIQUE INDEX "CampaignDelivery_campaignId_channel_recipientKey_key" ON "CampaignDelivery"("campaignId", "channel", "recipientKey");
CREATE INDEX "CampaignDelivery_churchId_status_scheduledAt_idx" ON "CampaignDelivery"("churchId", "status", "scheduledAt");
CREATE INDEX "CampaignDelivery_externalMessageId_idx" ON "CampaignDelivery"("externalMessageId");
CREATE UNIQUE INDEX "CampaignApproval_campaignId_contentVersion_key" ON "CampaignApproval"("campaignId", "contentVersion");
CREATE INDEX "CampaignApproval_approvedById_createdAt_idx" ON "CampaignApproval"("approvedById", "createdAt");
CREATE INDEX "CommunicationAuditEvent_churchId_createdAt_idx" ON "CommunicationAuditEvent"("churchId", "createdAt");
CREATE INDEX "CommunicationAuditEvent_campaignId_createdAt_idx" ON "CommunicationAuditEvent"("campaignId", "createdAt");
CREATE UNIQUE INDEX "WebhookEvent_provider_externalId_key" ON "WebhookEvent"("provider", "externalId");
CREATE INDEX "WebhookEvent_churchId_createdAt_idx" ON "WebhookEvent"("churchId", "createdAt");
CREATE UNIQUE INDEX "WhatsAppGroupCapability_churchId_key" ON "WhatsAppGroupCapability"("churchId");

ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "CommunicationAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationAuditEvent" ADD CONSTRAINT "CommunicationAuditEvent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAuditEvent" ADD CONSTRAINT "CommunicationAuditEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationAuditEvent" ADD CONSTRAINT "CommunicationAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppGroupCapability" ADD CONSTRAINT "WhatsAppGroupCapability_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
