export type Role = "ADMIN" | "MEMBER";
export type Permission =
  | "attendance.checkin.manual" | "attendance.sessions.manage" | "attendance.history.view" | "attendance.analytics.view"
  | "people.view" | "people.manage"
  | "services.view" | "services.content.edit" | "services.present" | "services.export" | "media.manage"
  | "schedule.view.own" | "schedule.propose" | "schedule.manage" | "ministry.manage"
  | "theme.manage" | "users.manage"
  | "communications.view" | "communications.create" | "communications.approve" | "communications.publish"
  | "communications.connections.manage" | "communications.consent.manage"
  | "offerings.capture" | "offerings.audit.view"
  | "offerings.view" | "offerings.manage";
export type PermissionScope = "attendance" | "services" | "theme" | "users";

export type ThemeMode = "light" | "dark";

export interface Church {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  logoAssetId?: string;
  timeZone: string;
  defaultPhoneRegion: string;
  currencyCode: string;
}

export interface ThemeSettings {
  churchId: string;
  primaryColor: string;
  accentColor: string;
  mode: ThemeMode;
  logoUrl?: string;
  headingStyle: "classic" | "modern" | "serif";
  exportHeader: "branded" | "minimal";
  slideTemplate: "centered" | "lower-third";
  songLinesPerSlide: number;
  textLinesPerSlide: number;
  maxCharactersPerSlide: number;
  defaultSlideWidth: number;
  defaultSlideHeight: number;
}

export type SlideBackgroundType = "COLOR" | "IMAGE";
export type SlideThemeLayout = "CENTERED" | "LOWER_THIRD";

export interface User {
  id: string;
  churchId: string;
  name: string;
  email: string;
  role: Role;
  personId?: string;
  permissions: Permission[];
  isActive: boolean;
  mustChangePassword: boolean;
}

export type PersonType = "MEMBER" | "VISITOR";
export type PersonStatus = "ACTIVE" | "INACTIVE" | "FOLLOW_UP";

export interface Person {
  id: string;
  churchId: string;
  personType: PersonType;
  status: PersonStatus;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  normalizedEmail?: string;
  normalizedPhone?: string;
  familyNotes?: string;
  tags: string[];
}

export interface AttendanceSession {
  id: string;
  churchId: string;
  title: string;
  serviceAt: string;
  qrToken: string;
  manualCode: string;
  servicePlanId?: string;
  status: "OPEN" | "CLOSED";
  expiresAt?: string;
  closedAt?: string;
}

export type MediaAssetRole = "PRIMARY" | "BACKGROUND" | "AUDIO" | "REFERENCE";

export interface MediaAsset {
  id: string;
  churchId: string;
  serviceItemId?: string;
  role: MediaAssetRole;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export interface SlideTheme {
  id: string;
  churchId: string;
  name: string;
  isDefault: boolean;
  backgroundType: SlideBackgroundType;
  backgroundColor: string;
  backgroundAssetId?: string;
  backgroundAsset?: MediaAsset;
  overlayColor: string;
  overlayOpacity: number;
  textColor: string;
  accentColor: string;
  layout: SlideThemeLayout;
  fontFamily?: "INTER" | "ARIAL" | "GEORGIA";
  titleFontSize?: number;
  bodyFontSize?: number;
  fontWeight?: number;
  safeMargin?: number;
  logoPlacement?: "NONE" | "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT";
}

export type AttendanceSource = "MANUAL" | "QR";

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  personId: string;
  source: AttendanceSource;
  checkedInAt: string;
  notes?: string;
}

export type ServiceItemType =
  | "SONG"
  | "SCRIPTURE"
  | "ANNOUNCEMENT"
  | "SERMON_NOTE"
  | "PRAYER"
  | "MEDIA_CUE"
  | "CUSTOM_TEXT";

export type ExportTag = "SLIDE" | "PDF" | "INTERNAL";

export interface ServiceItem {
  id: string;
  servicePlanId: string;
  type: ServiceItemType;
  title: string;
  body: string;
  notes?: string;
  durationMinutes?: number;
  sortOrder: number;
  exportTags: ExportTag[];
  mediaAssets: MediaAsset[];
  slideThemeId?: string;
}

export type ExportKind = "SLIDE_IMAGES" | "TEXT_PDF" | "RUN_SHEET_PDF" | "PROPRESENTER_PACKAGE";
export type ExportStatus = "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED" | "CANCELLED";

export interface ExportJob {
  id: string;
  churchId: string;
  servicePlanId?: string;
  kind: ExportKind;
  status: ExportStatus;
  fileName?: string;
  sizeBytes?: number;
  errorMessage?: string;
  expiresAt?: string;
  createdAt: string;
  width?: number;
  height?: number;
  renderOptions?: Record<string, unknown>;
  progress: number;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  cancelRequested: boolean;
}

export type AttendanceTrendPeriod = "month" | "semester" | "year";

export type OfferingTrendPeriod = "month" | "quarter" | "semester" | "year";

export interface OfferingTrendPoint {
  key: string;
  label: string;
  serviceCount: number;
  capturedCount: number;
  pendingCount: number;
  amountMinor: string;
}

export interface OfferingTrendSummary {
  totalAmountMinor: string;
  averageAmountMinor: string;
  peakAmountMinor: string;
  capturedCount: number;
  pendingCount: number;
  changePercent?: number;
}

export interface AttendanceTrendPoint {
  key: string;
  label: string;
  serviceCount: number;
  total: number;
  members: number;
  visitors: number;
}

export interface AttendanceTrendSummary {
  total: number;
  members: number;
  visitors: number;
  averagePerService: number;
  peak: number;
  serviceCount: number;
  changePercent?: number;
}

export interface ContentLibraryItem {
  id: string;
  churchId: string;
  type: ServiceItemType;
  title: string;
  body: string;
  notes?: string;
  exportTags: ExportTag[];
  lastUsedAt?: string;
}

export interface ServicePlan {
  id: string;
  churchId: string;
  title: string;
  topic?: string;
  serviceAt: string;
  status: "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";
  items: ServiceItem[];
  slideThemeId?: string;
}
