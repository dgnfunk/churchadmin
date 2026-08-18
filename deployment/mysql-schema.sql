-- CreateTable
CREATE TABLE `Church` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `logoUrl` TEXT NULL,
    `timeZone` VARCHAR(191) NOT NULL DEFAULT 'America/Monterrey',
    `defaultPhoneRegion` VARCHAR(191) NOT NULL DEFAULT 'MX',
    `logoAssetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Church_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThemeSettings` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#0f766e',
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#d69e2e',
    `mode` VARCHAR(191) NOT NULL DEFAULT 'light',
    `logoUrl` TEXT NULL,
    `headingStyle` VARCHAR(191) NOT NULL DEFAULT 'classic',
    `exportHeader` VARCHAR(191) NOT NULL DEFAULT 'branded',
    `slideTemplate` VARCHAR(191) NOT NULL DEFAULT 'centered',
    `songLinesPerSlide` INTEGER NOT NULL DEFAULT 2,
    `textLinesPerSlide` INTEGER NOT NULL DEFAULT 4,
    `maxCharactersPerSlide` INTEGER NOT NULL DEFAULT 180,
    `defaultSlideWidth` INTEGER NOT NULL DEFAULT 1920,
    `defaultSlideHeight` INTEGER NOT NULL DEFAULT 1080,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ThemeSettings_churchId_key`(`churchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `personId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_personId_key`(`personId`),
    UNIQUE INDEX `User_churchId_email_key`(`churchId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_token_key`(`token`),
    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Person` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `personType` ENUM('MEMBER', 'VISITOR') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'FOLLOW_UP') NOT NULL DEFAULT 'ACTIVE',
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `normalizedEmail` VARCHAR(191) NULL,
    `normalizedPhone` VARCHAR(191) NULL,
    `familyNotes` TEXT NULL,
    `tags` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Person_churchId_personType_idx`(`churchId`, `personType`),
    INDEX `Person_churchId_normalizedEmail_idx`(`churchId`, `normalizedEmail`),
    INDEX `Person_churchId_normalizedPhone_idx`(`churchId`, `normalizedPhone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceSession` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `serviceAt` DATETIME(3) NOT NULL,
    `qrToken` VARCHAR(191) NOT NULL,
    `manualCode` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `expiresAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `servicePlanId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AttendanceSession_qrToken_key`(`qrToken`),
    UNIQUE INDEX `AttendanceSession_manualCode_key`(`manualCode`),
    UNIQUE INDEX `AttendanceSession_servicePlanId_key`(`servicePlanId`),
    INDEX `AttendanceSession_churchId_serviceAt_idx`(`churchId`, `serviceAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `personId` VARCHAR(191) NOT NULL,
    `source` ENUM('MANUAL', 'QR') NOT NULL,
    `checkedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,

    UNIQUE INDEX `AttendanceRecord_sessionId_personId_key`(`sessionId`, `personId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendeeSession` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `personId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AttendeeSession_tokenHash_key`(`tokenHash`),
    INDEX `AttendeeSession_churchId_expiresAt_idx`(`churchId`, `expiresAt`),
    INDEX `AttendeeSession_personId_idx`(`personId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServicePlan` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NULL,
    `serviceAt` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `slideThemeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServicePlan_churchId_serviceAt_idx`(`churchId`, `serviceAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MinistryRole` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#0f766e',
    `basePermissions` JSON NOT NULL,
    `servicePermissions` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MinistryRole_churchId_isActive_sortOrder_idx`(`churchId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `MinistryRole_churchId_name_key`(`churchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MinistryMembership` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `personId` VARCHAR(191) NOT NULL,
    `ministryRoleId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MinistryMembership_churchId_isActive_idx`(`churchId`, `isActive`),
    UNIQUE INDEX `MinistryMembership_personId_ministryRoleId_key`(`personId`, `ministryRoleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceSlotTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ministryRoleId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServiceSlotTemplate_churchId_isActive_sortOrder_idx`(`churchId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `ServiceSlotTemplate_churchId_name_key`(`churchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceSlot` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `servicePlanId` VARCHAR(191) NOT NULL,
    `ministryRoleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServiceSlot_churchId_servicePlanId_sortOrder_idx`(`churchId`, `servicePlanId`, `sortOrder`),
    UNIQUE INDEX `ServiceSlot_servicePlanId_name_key`(`servicePlanId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleProposal` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `serviceSlotId` VARCHAR(191) NOT NULL,
    `personId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduleProposal_churchId_status_createdAt_idx`(`churchId`, `status`, `createdAt`),
    UNIQUE INDEX `ScheduleProposal_serviceSlotId_personId_key`(`serviceSlotId`, `personId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `serviceSlotId` VARCHAR(191) NOT NULL,
    `personId` VARCHAR(191) NOT NULL,
    `kind` ENUM('PRIMARY', 'BACKUP') NOT NULL,
    `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'REPLACED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    `confirmedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceAssignment_churchId_status_idx`(`churchId`, `status`),
    INDEX `ServiceAssignment_serviceSlotId_kind_status_idx`(`serviceSlotId`, `kind`, `status`),
    INDEX `ServiceAssignment_personId_status_idx`(`personId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `href` TEXT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `servicePlanId` VARCHAR(191) NOT NULL,
    `type` ENUM('SONG', 'SCRIPTURE', 'ANNOUNCEMENT', 'SERMON_NOTE', 'PRAYER', 'MEDIA_CUE', 'CUSTOM_TEXT') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `notes` TEXT NULL,
    `durationMinutes` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL,
    `exportTags` JSON NOT NULL,
    `slideThemeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceItem_servicePlanId_sortOrder_idx`(`servicePlanId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `serviceItemId` VARCHAR(191) NULL,
    `role` ENUM('PRIMARY', 'BACKGROUND', 'AUDIO', 'REFERENCE') NOT NULL DEFAULT 'PRIMARY',
    `originalName` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MediaAsset_storageKey_key`(`storageKey`),
    INDEX `MediaAsset_churchId_serviceItemId_idx`(`churchId`, `serviceItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SlideTheme` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `backgroundType` ENUM('COLOR', 'IMAGE') NOT NULL DEFAULT 'COLOR',
    `backgroundColor` VARCHAR(191) NOT NULL DEFAULT '#0f766e',
    `backgroundAssetId` VARCHAR(191) NULL,
    `overlayColor` VARCHAR(191) NOT NULL DEFAULT '#102421',
    `overlayOpacity` INTEGER NOT NULL DEFAULT 36,
    `textColor` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#d69e2e',
    `layout` ENUM('CENTERED', 'LOWER_THIRD') NOT NULL DEFAULT 'CENTERED',
    `fontFamily` ENUM('INTER', 'ARIAL', 'GEORGIA') NOT NULL DEFAULT 'INTER',
    `titleFontSize` INTEGER NOT NULL DEFAULT 82,
    `bodyFontSize` INTEGER NOT NULL DEFAULT 46,
    `fontWeight` INTEGER NOT NULL DEFAULT 700,
    `safeMargin` INTEGER NOT NULL DEFAULT 96,
    `logoPlacement` ENUM('NONE', 'TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT') NOT NULL DEFAULT 'TOP_LEFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SlideTheme_churchId_isDefault_idx`(`churchId`, `isDefault`),
    UNIQUE INDEX `SlideTheme_churchId_name_key`(`churchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExportJob` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `servicePlanId` VARCHAR(191) NULL,
    `kind` ENUM('SLIDE_IMAGES', 'TEXT_PDF', 'RUN_SHEET_PDF', 'PROPRESENTER_PACKAGE') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `fileUrl` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `sizeBytes` BIGINT NULL,
    `errorMessage` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `renderOptions` JSON NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `cancelRequested` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimitBucket` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `keyHash` VARCHAR(191) NOT NULL,
    `windowStart` DATETIME(3) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `RateLimitBucket_churchId_expiresAt_idx`(`churchId`, `expiresAt`),
    UNIQUE INDEX `RateLimitBucket_action_keyHash_windowStart_key`(`action`, `keyHash`, `windowStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentLibraryItem` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `type` ENUM('SONG', 'SCRIPTURE', 'ANNOUNCEMENT', 'SERMON_NOTE', 'PRAYER', 'MEDIA_CUE', 'CUSTOM_TEXT') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `normalizedTitle` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `notes` TEXT NULL,
    `exportTags` JSON NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContentLibraryItem_churchId_archivedAt_title_idx`(`churchId`, `archivedAt`, `title`),
    UNIQUE INDEX `ContentLibraryItem_churchId_type_normalizedTitle_key`(`churchId`, `type`, `normalizedTitle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UploadSession` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `offsetBytes` BIGINT NOT NULL DEFAULT 0,
    `storageKey` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UploadSession_churchId_expiresAt_idx`(`churchId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialConnection` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `provider` ENUM('WHATSAPP', 'FACEBOOK', 'INSTAGRAM') NOT NULL,
    `externalAccountId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `encryptedCredentials` LONGTEXT NULL,
    `metadata` JSON NULL,
    `grantedScopes` JSON NOT NULL,
    `status` ENUM('DISCONNECTED', 'CONNECTED', 'EXPIRED', 'ERROR', 'SUSPENDED') NOT NULL DEFAULT 'DISCONNECTED',
    `expiresAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SocialConnection_churchId_provider_status_idx`(`churchId`, `provider`, `status`),
    UNIQUE INDEX `SocialConnection_churchId_provider_externalAccountId_key`(`churchId`, `provider`, `externalAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationConsent` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `personId` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'FACEBOOK', 'INSTAGRAM') NOT NULL,
    `normalizedRecipient` VARCHAR(191) NOT NULL,
    `status` ENUM('OPTED_IN', 'OPTED_OUT', 'PENDING') NOT NULL DEFAULT 'PENDING',
    `source` VARCHAR(191) NOT NULL,
    `evidence` TEXT NULL,
    `optedInAt` DATETIME(3) NULL,
    `optedOutAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunicationConsent_churchId_channel_status_idx`(`churchId`, `channel`, `status`),
    INDEX `CommunicationConsent_churchId_normalizedRecipient_idx`(`churchId`, `normalizedRecipient`),
    UNIQUE INDEX `CommunicationConsent_churchId_personId_channel_key`(`churchId`, `personId`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationAudience` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `criteria` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunicationAudience_churchId_isActive_idx`(`churchId`, `isActive`),
    UNIQUE INDEX `CommunicationAudience_churchId_name_key`(`churchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `channels` JSON NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'es_MX',
    `category` ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION') NOT NULL DEFAULT 'MARKETING',
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED') NOT NULL DEFAULT 'DRAFT',
    `approvalMode` ENUM('AUTOMATIC', 'REQUIRED') NOT NULL DEFAULT 'REQUIRED',
    `content` JSON NOT NULL,
    `defaultSchedule` JSON NULL,
    `remoteTemplateId` VARCHAR(191) NULL,
    `remoteTemplateName` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunicationTemplate_churchId_status_idx`(`churchId`, `status`),
    UNIQUE INDEX `CommunicationTemplate_churchId_name_key`(`churchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `servicePlanId` VARCHAR(191) NULL,
    `templateId` VARCHAR(191) NULL,
    `audienceId` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sourceUrl` TEXT NOT NULL,
    `youtubeVideoId` VARCHAR(191) NOT NULL,
    `youtubeTitle` VARCHAR(191) NOT NULL,
    `youtubeDescription` LONGTEXT NULL,
    `youtubeChannel` VARCHAR(191) NULL,
    `youtubeThumbnailUrl` TEXT NULL,
    `content` JSON NOT NULL,
    `status` ENUM('DRAFT', 'WAITING_APPROVAL', 'SCHEDULED', 'PROCESSING', 'PARTIAL', 'COMPLETE', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `approvalMode` ENUM('AUTOMATIC', 'REQUIRED') NOT NULL DEFAULT 'REQUIRED',
    `scheduledAt` DATETIME(3) NULL,
    `relativeDayOffset` INTEGER NULL,
    `relativeLocalTime` VARCHAR(191) NULL,
    `contentVersion` INTEGER NOT NULL DEFAULT 1,
    `approvedVersion` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunicationCampaign_churchId_status_scheduledAt_idx`(`churchId`, `status`, `scheduledAt`),
    INDEX `CommunicationCampaign_servicePlanId_idx`(`servicePlanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'FACEBOOK', 'INSTAGRAM') NOT NULL,
    `connectionId` VARCHAR(191) NULL,
    `personId` VARCHAR(191) NULL,
    `recipientKey` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NULL,
    `content` JSON NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lockedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `externalMessageId` VARCHAR(191) NULL,
    `externalPostUrl` TEXT NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampaignDelivery_churchId_status_scheduledAt_idx`(`churchId`, `status`, `scheduledAt`),
    INDEX `CampaignDelivery_externalMessageId_idx`(`externalMessageId`),
    UNIQUE INDEX `CampaignDelivery_campaignId_channel_recipientKey_key`(`campaignId`, `channel`, `recipientKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignApproval` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NOT NULL,
    `contentVersion` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CampaignApproval_approvedById_createdAt_idx`(`approvedById`, `createdAt`),
    UNIQUE INDEX `CampaignApproval_campaignId_contentVersion_key`(`campaignId`, `contentVersion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationAuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunicationAuditEvent_churchId_createdAt_idx`(`churchId`, `createdAt`),
    INDEX `CommunicationAuditEvent_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NULL,
    `provider` ENUM('WHATSAPP', 'FACEBOOK', 'INSTAGRAM') NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `payloadHash` VARCHAR(191) NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookEvent_churchId_createdAt_idx`(`churchId`, `createdAt`),
    UNIQUE INDEX `WebhookEvent_provider_externalId_key`(`provider`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppGroupCapability` (
    `id` VARCHAR(191) NOT NULL,
    `churchId` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_CHECKED', 'INELIGIBLE', 'ELIGIBLE', 'CONNECTED', 'SUSPENDED') NOT NULL DEFAULT 'NOT_CHECKED',
    `checkedAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WhatsAppGroupCapability_churchId_key`(`churchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Church` ADD CONSTRAINT `Church_logoAssetId_fkey` FOREIGN KEY (`logoAssetId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThemeSettings` ADD CONSTRAINT `ThemeSettings_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Person` ADD CONSTRAINT `Person_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceSession` ADD CONSTRAINT `AttendanceSession_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceSession` ADD CONSTRAINT `AttendanceSession_servicePlanId_fkey` FOREIGN KEY (`servicePlanId`) REFERENCES `ServicePlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `AttendanceSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendeeSession` ADD CONSTRAINT `AttendeeSession_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendeeSession` ADD CONSTRAINT `AttendeeSession_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServicePlan` ADD CONSTRAINT `ServicePlan_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServicePlan` ADD CONSTRAINT `ServicePlan_slideThemeId_fkey` FOREIGN KEY (`slideThemeId`) REFERENCES `SlideTheme`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MinistryRole` ADD CONSTRAINT `MinistryRole_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MinistryMembership` ADD CONSTRAINT `MinistryMembership_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MinistryMembership` ADD CONSTRAINT `MinistryMembership_ministryRoleId_fkey` FOREIGN KEY (`ministryRoleId`) REFERENCES `MinistryRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceSlotTemplate` ADD CONSTRAINT `ServiceSlotTemplate_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceSlotTemplate` ADD CONSTRAINT `ServiceSlotTemplate_ministryRoleId_fkey` FOREIGN KEY (`ministryRoleId`) REFERENCES `MinistryRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceSlot` ADD CONSTRAINT `ServiceSlot_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceSlot` ADD CONSTRAINT `ServiceSlot_servicePlanId_fkey` FOREIGN KEY (`servicePlanId`) REFERENCES `ServicePlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceSlot` ADD CONSTRAINT `ServiceSlot_ministryRoleId_fkey` FOREIGN KEY (`ministryRoleId`) REFERENCES `MinistryRole`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleProposal` ADD CONSTRAINT `ScheduleProposal_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleProposal` ADD CONSTRAINT `ScheduleProposal_serviceSlotId_fkey` FOREIGN KEY (`serviceSlotId`) REFERENCES `ServiceSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleProposal` ADD CONSTRAINT `ScheduleProposal_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceAssignment` ADD CONSTRAINT `ServiceAssignment_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceAssignment` ADD CONSTRAINT `ServiceAssignment_serviceSlotId_fkey` FOREIGN KEY (`serviceSlotId`) REFERENCES `ServiceSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceAssignment` ADD CONSTRAINT `ServiceAssignment_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceItem` ADD CONSTRAINT `ServiceItem_servicePlanId_fkey` FOREIGN KEY (`servicePlanId`) REFERENCES `ServicePlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceItem` ADD CONSTRAINT `ServiceItem_slideThemeId_fkey` FOREIGN KEY (`slideThemeId`) REFERENCES `SlideTheme`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_serviceItemId_fkey` FOREIGN KEY (`serviceItemId`) REFERENCES `ServiceItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlideTheme` ADD CONSTRAINT `SlideTheme_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlideTheme` ADD CONSTRAINT `SlideTheme_backgroundAssetId_fkey` FOREIGN KEY (`backgroundAssetId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportJob` ADD CONSTRAINT `ExportJob_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportJob` ADD CONSTRAINT `ExportJob_servicePlanId_fkey` FOREIGN KEY (`servicePlanId`) REFERENCES `ServicePlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateLimitBucket` ADD CONSTRAINT `RateLimitBucket_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentLibraryItem` ADD CONSTRAINT `ContentLibraryItem_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadSession` ADD CONSTRAINT `UploadSession_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SocialConnection` ADD CONSTRAINT `SocialConnection_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationConsent` ADD CONSTRAINT `CommunicationConsent_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationConsent` ADD CONSTRAINT `CommunicationConsent_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationAudience` ADD CONSTRAINT `CommunicationAudience_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationTemplate` ADD CONSTRAINT `CommunicationTemplate_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationCampaign` ADD CONSTRAINT `CommunicationCampaign_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationCampaign` ADD CONSTRAINT `CommunicationCampaign_servicePlanId_fkey` FOREIGN KEY (`servicePlanId`) REFERENCES `ServicePlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationCampaign` ADD CONSTRAINT `CommunicationCampaign_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `CommunicationTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationCampaign` ADD CONSTRAINT `CommunicationCampaign_audienceId_fkey` FOREIGN KEY (`audienceId`) REFERENCES `CommunicationAudience`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationCampaign` ADD CONSTRAINT `CommunicationCampaign_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignDelivery` ADD CONSTRAINT `CampaignDelivery_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignDelivery` ADD CONSTRAINT `CampaignDelivery_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CommunicationCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignDelivery` ADD CONSTRAINT `CampaignDelivery_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `SocialConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignDelivery` ADD CONSTRAINT `CampaignDelivery_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `Person`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignApproval` ADD CONSTRAINT `CampaignApproval_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CommunicationCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignApproval` ADD CONSTRAINT `CampaignApproval_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationAuditEvent` ADD CONSTRAINT `CommunicationAuditEvent_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationAuditEvent` ADD CONSTRAINT `CommunicationAuditEvent_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CommunicationCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationAuditEvent` ADD CONSTRAINT `CommunicationAuditEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookEvent` ADD CONSTRAINT `WebhookEvent_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppGroupCapability` ADD CONSTRAINT `WhatsAppGroupCapability_churchId_fkey` FOREIGN KEY (`churchId`) REFERENCES `Church`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
