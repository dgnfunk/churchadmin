import type {
  AttendanceRecord,
  AttendanceSession,
  Church,
  Person,
  ServicePlan,
  SlideTheme,
  ThemeSettings,
  User
} from "./domain";

export const church: Church = {
  id: "church-demo",
  name: "Grace Community Church",
  slug: "grace-community",
  timeZone: "America/Monterrey",
  defaultPhoneRegion: "MX",
  currencyCode: "MXN"
};

export const theme: ThemeSettings = {
  churchId: church.id,
  primaryColor: "#0f766e",
  accentColor: "#d69e2e",
  mode: "light",
  headingStyle: "classic",
  exportHeader: "branded",
  slideTemplate: "centered"
  ,songLinesPerSlide: 2
  ,textLinesPerSlide: 4
  ,maxCharactersPerSlide: 180
  ,defaultSlideWidth: 1920
  ,defaultSlideHeight: 1080
};

export const slideThemes: SlideTheme[] = [{
  id: "slide-theme-default",
  churchId: church.id,
  name: "Church Default",
  isDefault: true,
  backgroundType: "COLOR",
  backgroundColor: theme.primaryColor,
  overlayColor: "#102421",
  overlayOpacity: 36,
  textColor: "#ffffff",
  accentColor: theme.accentColor,
  layout: "CENTERED"
}];

export const users: User[] = [
  {
    id: "user-admin",
    churchId: church.id,
    name: "Elena Rivera",
    email: "elena@grace.example",
    role: "ADMIN",
    permissions: [], isActive: true, mustChangePassword: false
  },
  {
    id: "user-volunteer",
    churchId: church.id,
    name: "Marco Santos",
    email: "marco@grace.example",
    role: "MEMBER",
    permissions: ["schedule.view.own", "schedule.propose"], isActive: true, mustChangePassword: false
  }
];

export const people: Person[] = [
  {
    id: "person-1",
    churchId: church.id,
    personType: "MEMBER",
    status: "ACTIVE",
    firstName: "Ana",
    lastName: "Lopez",
    email: "ana@example.com",
    phone: "555-0142",
    familyNotes: "Lopez family",
    tags: ["choir", "women"]
  },
  {
    id: "person-2",
    churchId: church.id,
    personType: "MEMBER",
    status: "ACTIVE",
    firstName: "Daniel",
    lastName: "Martinez",
    email: "daniel@example.com",
    phone: "555-0178",
    tags: ["youth"]
  },
  {
    id: "person-3",
    churchId: church.id,
    personType: "VISITOR",
    status: "FOLLOW_UP",
    firstName: "Mia",
    lastName: "Garcia",
    email: "mia@example.com",
    phone: "555-0199",
    familyNotes: "Visited after invitation from Ana",
    tags: ["first-time"]
  }
];

export const attendanceSessions: AttendanceSession[] = [
  {
    id: "session-1",
    churchId: church.id,
    title: "Sunday Worship",
    serviceAt: "2026-06-28T10:00:00.000Z",
    qrToken: "grace-2026-06-28",
    manualCode: "GRCE-0628",
    status: "CLOSED"
  },
  {
    id: "session-2",
    churchId: church.id,
    title: "Prayer Night",
    serviceAt: "2026-06-24T19:00:00.000Z",
    qrToken: "grace-prayer-2026-06-24",
    manualCode: "PRAY-0624",
    status: "CLOSED"
  }
];

export const attendanceRecords: AttendanceRecord[] = [
  {
    id: "attendance-1",
    sessionId: "session-1",
    personId: "person-1",
    source: "MANUAL",
    checkedInAt: "2026-06-28T10:02:00.000Z"
  },
  {
    id: "attendance-2",
    sessionId: "session-1",
    personId: "person-2",
    source: "QR",
    checkedInAt: "2026-06-28T10:04:00.000Z"
  },
  {
    id: "attendance-3",
    sessionId: "session-1",
    personId: "person-3",
    source: "QR",
    checkedInAt: "2026-06-28T10:09:00.000Z"
  }
];

export const servicePlans: ServicePlan[] = [
  {
    id: "service-1",
    churchId: church.id,
    title: "Sunday Worship",
    topic: "A Faithful House",
    serviceAt: "2026-06-28T10:00:00.000Z",
    status: "PUBLISHED",
    items: [
      {
        id: "item-1",
        servicePlanId: "service-1",
        type: "SONG",
        title: "Opening Song",
        body: "Verse 1\nWe gather as one family\nChorus\nLet every heart sing with joy",
        notes: "Worship team begins after welcome.",
        durationMinutes: 5,
        sortOrder: 1,
        exportTags: ["SLIDE", "PDF"]
        ,mediaAssets: []
      },
      {
        id: "item-2",
        servicePlanId: "service-1",
        type: "SCRIPTURE",
        title: "Psalm Reading",
        body: "Psalm 84:1-2\nHow lovely is your dwelling place, Lord Almighty.",
        durationMinutes: 3,
        sortOrder: 2,
        exportTags: ["SLIDE", "PDF"]
        ,mediaAssets: []
      },
      {
        id: "item-3",
        servicePlanId: "service-1",
        type: "ANNOUNCEMENT",
        title: "Community Lunch",
        body: "Join us after service next Sunday for lunch and fellowship in the family hall.",
        durationMinutes: 2,
        sortOrder: 3,
        exportTags: ["SLIDE", "PDF"]
        ,mediaAssets: []
      },
      {
        id: "item-4",
        servicePlanId: "service-1",
        type: "SERMON_NOTE",
        title: "Sermon Points",
        body: "1. God builds his people together.\n2. Faithfulness is practiced in community.\n3. Hospitality makes the gospel visible.",
        notes: "Pastor can expand point 2 if time allows.",
        durationMinutes: 28,
        sortOrder: 4,
        exportTags: ["PDF", "INTERNAL"]
        ,mediaAssets: []
      },
      {
        id: "item-5",
        servicePlanId: "service-1",
        type: "MEDIA_CUE",
        title: "Closing Video",
        body: "Play missions recap video after final prayer.",
        notes: "Media volunteer confirms audio before service.",
        durationMinutes: 4,
        sortOrder: 5,
        exportTags: ["INTERNAL"]
        ,mediaAssets: []
      }
    ]
  }
];
