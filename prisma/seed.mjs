import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const passwordSecret = process.env.PASSWORD_SECRET ?? "churchadmin-dev-secret";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin1234";
const memberPassword = process.env.SEED_MEMBER_PASSWORD || process.env.SEED_VOLUNTEER_PASSWORD || "member1234";
const timeZone = "America/Monterrey";
const church = {
  id: "church-demo",
  name: "Iglesia Comunidad de Gracia",
  slug: "grace-community",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${password}:${passwordSecret}`, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function localDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function latestCompletedSunday() {
  const now = new Date();
  const local = localDateParts(now);
  const localNoon = new Date(Date.UTC(local.year, local.month - 1, local.day, 12));
  const sundayNoon = new Date(localNoon.getTime() - localNoon.getUTCDay() * DAY_MS);
  let serviceAt = new Date(Date.UTC(
    sundayNoon.getUTCFullYear(),
    sundayNoon.getUTCMonth(),
    sundayNoon.getUTCDate(),
    16,
  ));
  if (serviceAt > now) serviceAt = new Date(serviceAt.getTime() - WEEK_MS);
  return serviceAt;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function rotate(values, offset) {
  return values[offset % values.length];
}

function serviceItems(servicePlanId, index, topic, scripture) {
  const songs = [
    ["Tu fidelidad nos sostiene", "Tu fidelidad nos sostiene\nTu gracia nos vuelve a levantar\n---\nCaminamos juntos en esperanza\nTu amor nos ensena a servir"],
    ["Celebramos tu bondad", "Celebramos tu bondad\nCon gratitud venimos hoy\n---\nCada familia, una sola voz\nProclamando tu amor"],
    ["Luz para el camino", "Tu palabra es luz para el camino\nTu presencia trae paz\n---\nGuianos para amar al projimo\nY vivir con integridad"],
  ];
  const song = songs[index % songs.length];
  return [
    {
      id: `${servicePlanId}-item-01`, servicePlanId, type: "CUSTOM_TEXT", title: "Bienvenida",
      body: `Bienvenidos a Iglesia Comunidad de Gracia\n${topic}`,
      notes: "Recibir a quienes nos visitan y explicar brevemente el orden del servicio.", durationMinutes: 4, sortOrder: 1, exportTags: ["SLIDE", "INTERNAL"],
    },
    {
      id: `${servicePlanId}-item-02`, servicePlanId, type: "SONG", title: song[0], body: song[1],
      notes: "La banda inicia despues de la bienvenida.", durationMinutes: 6, sortOrder: 2, exportTags: ["SLIDE", "PDF"],
    },
    {
      id: `${servicePlanId}-item-03`, servicePlanId, type: "SCRIPTURE", title: scripture,
      body: `${scripture}\nLectura congregacional y reflexion sobre ${topic.toLowerCase()}.`,
      notes: "Mostrar la referencia antes de comenzar la lectura.", durationMinutes: 4, sortOrder: 3, exportTags: ["SLIDE", "PDF"],
    },
    {
      id: `${servicePlanId}-item-04`, servicePlanId, type: "ANNOUNCEMENT", title: "Vida de la comunidad",
      body: index % 2 === 0
        ? "Grupos en casa durante la semana\nRegistro de voluntarios al terminar el servicio\nOracion comunitaria el miercoles a las 7:00 p.m."
        : "Encuentro de jovenes el viernes\nColecta de alimentos durante todo el mes\nInformes en la mesa de bienvenida",
      notes: null, durationMinutes: 5, sortOrder: 4, exportTags: ["SLIDE", "PDF"],
    },
    {
      id: `${servicePlanId}-item-05`, servicePlanId, type: "SERMON_NOTE", title: topic,
      body: `1. Comprender el llamado de Dios.\n2. Practicar la fe en comunidad.\n3. Responder con servicio y generosidad.`,
      notes: `Mensaje principal basado en ${scripture}. Dejar cinco minutos para oracion al final.`, durationMinutes: 30, sortOrder: 5, exportTags: ["PDF", "INTERNAL"],
    },
    {
      id: `${servicePlanId}-item-06`, servicePlanId, type: "PRAYER", title: "Oracion y envio",
      body: "Oracion por las familias, quienes nos visitan y las necesidades de la comunidad.",
      notes: "El equipo de bienvenida permanece disponible al terminar.", durationMinutes: 6, sortOrder: 6, exportTags: ["INTERNAL"],
    },
  ];
}

const members = [
  ["elena", "Elena", "Rivera", "elena@grace.example", "+528110001001", ["administracion"]],
  ["samuel", "Samuel", "Herrera", "samuel@grace.example", "+528110001002", ["pastor"]],
  ["laura", "Laura", "Mendez", "laura@grace.example", "+528110001003", ["pastor", "consejeria"]],
  ["marco", "Marco", "Santos", "marco@grace.example", "+528110001004", ["alabanza", "guitarra"]],
  ["sofia", "Sofia", "Reyes", "sofia@grace.example", "+528110001005", ["alabanza", "voz"]],
  ["andres", "Andres", "Castillo", "andres@grace.example", "+528110001006", ["presentacion"]],
  ["valeria", "Valeria", "Cruz", "valeria@grace.example", "+528110001007", ["presentacion"]],
  ["diego", "Diego", "Navarro", "diego@grace.example", "+528110001008", ["asistencia"]],
  ["paola", "Paola", "Jimenez", "paola@grace.example", "+528110001009", ["asistencia", "bienvenida"]],
  ["luis", "Luis", "Ortega", "luis@grace.example", "+528110001010", ["audio"]],
  ["fernanda", "Fernanda", "Salas", "fernanda@grace.example", "+528110001011", ["multimedia"]],
  ["ricardo", "Ricardo", "Vega", "ricardo@grace.example", "+528110001012", ["alabanza", "bajo"]],
  ["gabriela", "Gabriela", "Flores", "gabriela@grace.example", "+528110001013", ["ninos"]],
  ["javier", "Javier", "Morales", "javier@grace.example", "+528110001014", ["bienvenida"]],
  ["daniela", "Daniela", "Ramos", "daniela@grace.example", "+528110001015", ["jovenes"]],
  ["miguel", "Miguel", "Torres", "miguel@grace.example", "+528110001016", ["grupos-en-casa"]],
  ["alejandra", "Alejandra", "Guzman", "alejandra@grace.example", "+528110001017", ["oracion"]],
  ["roberto", "Roberto", "Ibarra", "roberto@grace.example", "+528110001018", ["logistica"]],
  ["patricia", "Patricia", "Cantu", "patricia@grace.example", "+528110001019", ["hospitalidad"]],
  ["oscar", "Oscar", "Luna", "oscar@grace.example", "+528110001020", ["matrimonios"]],
  ["monica", "Monica", "Garza", "monica@grace.example", "+528110001021", ["mujeres"]],
  ["hector", "Hector", "Solis", "hector@grace.example", "+528110001022", ["hombres"]],
  ["claudia", "Claudia", "Pena", "claudia@grace.example", "+528110001023", ["ninos"]],
  ["ernesto", "Ernesto", "Leal", "ernesto@grace.example", "+528110001024", ["servicio"]],
].map(([key, firstName, lastName, email, phone, tags]) => ({
  id: `person-member-${key}`, churchId: church.id, personType: "MEMBER", status: "ACTIVE",
  firstName, lastName, email, phone, normalizedEmail: email.toLowerCase(), normalizedPhone: phone.replace(/\D/g, ""),
  familyNotes: null, tags,
}));

const visitors = [
  ["natalia", "Natalia", "Fuentes", "natalia@example.com", "+528120001101", 0],
  ["cesar", "Cesar", "Aguilar", "cesar@example.com", "+528120001102", 1],
  ["karla", "Karla", "Benitez", "karla@example.com", "+528120001103", 2],
  ["ivan", "Ivan", "Dominguez", "ivan@example.com", "+528120001104", 3],
  ["renata", "Renata", "Esquivel", "renata@example.com", "+528120001105", 4],
  ["tomas", "Tomas", "Valdez", "tomas@example.com", "+528120001106", 5],
  ["lucia", "Lucia", "Treviño", "lucia@example.com", "+528120001107", 6],
  ["emilio", "Emilio", "Zamora", "emilio@example.com", "+528120001108", 7],
].map(([key, firstName, lastName, email, phone, firstSeen]) => ({
  id: `person-visitor-${key}`, churchId: church.id, personType: "VISITOR", status: firstSeen < 4 ? "FOLLOW_UP" : "ACTIVE",
  firstName, lastName, email, phone, normalizedEmail: email.toLowerCase(), normalizedPhone: phone.replace(/\D/g, ""),
  familyNotes: "Registro creado desde el check-in de un servicio dominical.", tags: firstSeen < 4 ? ["seguimiento"] : ["visitante-recurrente"], firstSeen,
}));

const roleDefinitions = [
  { id: "role-demo-pastor", name: "Pastor", description: "Liderazgo pastoral y consulta de tendencias de asistencia.", color: "#7c3aed", basePermissions: ["attendance.analytics.view", "attendance.history.view", "services.view", "communications.view", "communications.approve"], servicePermissions: ["services.view", "services.content.edit"], sortOrder: 1 },
  { id: "role-demo-worship", name: "Alabanza", description: "Direccion musical y preparacion del contenido de alabanza.", color: "#0f766e", basePermissions: [], servicePermissions: ["services.view", "services.content.edit", "media.manage"], sortOrder: 2 },
  { id: "role-demo-presenter", name: "Presentacion", description: "Operacion de diapositivas y exportaciones del servicio.", color: "#2563eb", basePermissions: [], servicePermissions: ["services.view", "services.present", "services.export"], sortOrder: 3 },
  { id: "role-demo-attendance", name: "Asistencia", description: "Registro manual de personas durante el servicio asignado.", color: "#d97706", basePermissions: [], servicePermissions: ["attendance.checkin.manual"], sortOrder: 4 },
  { id: "role-demo-media", name: "Audio y multimedia", description: "Operacion de audio y recursos multimedia del servicio.", color: "#64748b", basePermissions: [], servicePermissions: ["services.view", "media.manage"], sortOrder: 5 },
  { id: "role-demo-communications", name: "Comunicaciones", description: "Preparacion y programacion de anuncios oficiales.", color: "#be185d", basePermissions: ["communications.view", "communications.create", "communications.publish", "communications.consent.manage"], servicePermissions: [], sortOrder: 6 },
];

const slotDefinitions = [
  { key: "pastor", name: "Pastor", roleId: "role-demo-pastor", primary: ["samuel", "laura"], backup: ["laura", "samuel"] },
  { key: "worship", name: "Lider de alabanza", roleId: "role-demo-worship", primary: ["marco", "sofia", "ricardo"], backup: ["sofia", "ricardo", "marco"] },
  { key: "presenter", name: "Presentacion", roleId: "role-demo-presenter", primary: ["andres", "valeria"], backup: ["valeria", "andres"] },
  { key: "attendance", name: "Registro de asistencia", roleId: "role-demo-attendance", primary: ["diego", "paola"], backup: ["paola", "diego"] },
  { key: "media", name: "Audio y multimedia", roleId: "role-demo-media", primary: ["luis", "fernanda"], backup: ["fernanda", "luis"] },
];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_DATA !== "true") {
    throw new Error("Demo seed blocked in production. Run the explicit db:seed:demo command to replace the demo church data.");
  }
  if (process.env.NODE_ENV === "production" && (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_MEMBER_PASSWORD)) {
    throw new Error("SEED_ADMIN_PASSWORD and SEED_MEMBER_PASSWORD are required when seeding a hosted demo.");
  }

  await prisma.church.deleteMany({ where: { OR: [{ id: church.id }, { slug: church.slug }] } });

  await prisma.church.create({
    data: { ...church, logoUrl: null, logoAssetId: null, timeZone, defaultPhoneRegion: "MX" },
  });
  await prisma.themeSettings.create({
    data: {
      churchId: church.id, primaryColor: "#0f766e", accentColor: "#d69e2e", mode: "light", logoUrl: null,
      headingStyle: "classic", exportHeader: "branded", slideTemplate: "centered", songLinesPerSlide: 2,
      textLinesPerSlide: 4, maxCharactersPerSlide: 180, defaultSlideWidth: 1920, defaultSlideHeight: 1080,
    },
  });
  await prisma.slideTheme.create({
    data: {
      id: "slide-theme-default", churchId: church.id, name: "Tema Comunidad de Gracia", isDefault: true,
      backgroundType: "COLOR", backgroundColor: "#0f766e", overlayColor: "#102421", overlayOpacity: 36,
      textColor: "#ffffff", accentColor: "#d69e2e", layout: "CENTERED", fontFamily: "INTER",
      titleFontSize: 82, bodyFontSize: 46, fontWeight: 700, safeMargin: 96, logoPlacement: "NONE",
    },
  });

  await prisma.ministryRole.createMany({ data: roleDefinitions.map((role) => ({ ...role, churchId: church.id, isActive: true })) });
  await prisma.serviceSlotTemplate.createMany({
    data: slotDefinitions.map((slot, index) => ({
      id: `slot-template-demo-${slot.key}`, churchId: church.id, name: slot.name,
      ministryRoleId: slot.roleId, sortOrder: index + 1, isActive: true,
    })),
  });

  const people = [...members, ...visitors.map(({ firstSeen: _firstSeen, ...visitor }) => visitor)];
  await prisma.person.createMany({ data: people });

  const memberId = (key) => `person-member-${key}`;
  const memberships = [
    ["samuel", "role-demo-pastor"], ["laura", "role-demo-pastor"],
    ["marco", "role-demo-worship"], ["sofia", "role-demo-worship"], ["ricardo", "role-demo-worship"],
    ["andres", "role-demo-presenter"], ["valeria", "role-demo-presenter"],
    ["diego", "role-demo-attendance"], ["paola", "role-demo-attendance"],
    ["luis", "role-demo-media"], ["fernanda", "role-demo-media"],
    ["fernanda", "role-demo-communications"],
  ];
  await prisma.ministryMembership.createMany({
    data: memberships.map(([personKey, ministryRoleId]) => ({ churchId: church.id, personId: memberId(personKey), ministryRoleId, isActive: true })),
  });

  await prisma.user.createMany({
    data: [
      { id: "user-admin", churchId: church.id, personId: memberId("elena"), name: "Elena Rivera", email: "elena@grace.example", role: "ADMIN", passwordHash: hashPassword(adminPassword), isActive: true },
      { id: "user-pastor", churchId: church.id, personId: memberId("samuel"), name: "Samuel Herrera", email: "samuel@grace.example", role: "MEMBER", passwordHash: hashPassword(memberPassword), isActive: true },
      { id: "user-member", churchId: church.id, personId: memberId("marco"), name: "Marco Santos", email: "marco@grace.example", role: "MEMBER", passwordHash: hashPassword(memberPassword), isActive: true },
      { id: "user-presenter", churchId: church.id, personId: memberId("andres"), name: "Andres Castillo", email: "andres@grace.example", role: "MEMBER", passwordHash: hashPassword(memberPassword), isActive: true },
    ],
  });

  await prisma.contentLibraryItem.createMany({
    data: [
      { id: "library-demo-song", churchId: church.id, type: "SONG", title: "Tu fidelidad nos sostiene", normalizedTitle: "tu fidelidad nos sostiene", body: "Tu fidelidad nos sostiene\nTu gracia nos vuelve a levantar", notes: "Cancion original para el escenario demo.", exportTags: ["SLIDE", "PDF"] },
      { id: "library-demo-welcome", churchId: church.id, type: "CUSTOM_TEXT", title: "Bienvenida dominical", normalizedTitle: "bienvenida dominical", body: "Bienvenidos a Iglesia Comunidad de Gracia", notes: null, exportTags: ["SLIDE"] },
      { id: "library-demo-announcement", churchId: church.id, type: "ANNOUNCEMENT", title: "Grupos en casa", normalizedTitle: "grupos en casa", body: "Conectate con un grupo durante la semana. Informes en la mesa de bienvenida.", notes: null, exportTags: ["SLIDE", "PDF"] },
    ],
  });

  await prisma.communicationAudience.createMany({
    data: [
      { id: "audience-demo-members", churchId: church.id, name: "Miembros activos", description: "Miembros activos con consentimiento de WhatsApp.", criteria: { type: "MEMBERS" } },
      { id: "audience-demo-visitors", churchId: church.id, name: "Visitantes en seguimiento", description: "Visitantes activos y en seguimiento.", criteria: { type: "VISITORS" } },
    ],
  });
  await prisma.communicationTemplate.create({
    data: {
      id: "communications-template-demo-youtube", churchId: church.id, name: "Nueva transmisión de YouTube",
      channels: ["WHATSAPP", "FACEBOOK", "INSTAGRAM"], language: "es_MX", category: "MARKETING",
      status: "DRAFT", approvalMode: "REQUIRED",
      content: {
        WHATSAPP: "Hola {{person.firstName}}, ya está disponible {{youtube.title}} de {{church.name}}.\n\n{{youtube.url}}",
        FACEBOOK: "Ya está disponible {{youtube.title}}. Te invitamos a verlo y compartirlo.",
        INSTAGRAM: "Ya está disponible {{youtube.title}} de {{church.name}}.\n\n{{youtube.url}}",
      },
    },
  });
  await prisma.communicationConsent.createMany({
    data: members.slice(0, 12).map((person) => ({
      churchId: church.id, personId: person.id, channel: "WHATSAPP", normalizedRecipient: person.normalizedPhone,
      status: "OPTED_IN", source: "Formulario de membresía", evidence: "Consentimiento demo para comunicaciones de la iglesia.", optedInAt: new Date(),
    })),
  });

  const topics = [
    "Una comunidad que persevera", "Esperanza en tiempos de cambio", "Servir con alegria", "Familias que crecen juntas",
    "Una fe que se comparte", "Generosidad que transforma", "Paz para el camino", "El valor de permanecer",
    "Compasion por nuestra ciudad", "Vivir con proposito", "Gratitud en cada temporada",
  ];
  const scriptures = ["Hechos 2:42-47", "Romanos 12:9-13", "Marcos 10:42-45", "Josue 24:14-15", "1 Pedro 3:15-16", "2 Corintios 9:6-8", "Filipenses 4:6-7", "Juan 15:4-5", "Miqueas 6:8", "Efesios 2:10", "1 Tesalonicenses 5:16-18"];
  const memberCounts = [16, 18, 17, 20, 19, 21, 22, 20, 24, 23];
  const visitorCounts = [1, 2, 1, 3, 2, 4, 3, 5, 4, 6];
  const latestSunday = latestCompletedSunday();
  const serviceDates = Array.from({ length: 10 }, (_, index) => new Date(latestSunday.getTime() - (9 - index) * WEEK_MS));
  serviceDates.push(new Date(latestSunday.getTime() + WEEK_MS));

  for (let index = 0; index < serviceDates.length; index += 1) {
    const serviceAt = serviceDates[index];
    const isUpcoming = index === serviceDates.length - 1;
    const key = String(index + 1).padStart(2, "0");
    const servicePlanId = `demo-service-${key}`;
    const endedAt = new Date(serviceAt.getTime() + 75 * 60 * 1000);

    await prisma.servicePlan.create({
      data: {
        id: servicePlanId, churchId: church.id, title: `Servicio dominical - ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone }).format(serviceAt)}`,
        topic: topics[index], serviceAt, status: isUpcoming ? "PUBLISHED" : "COMPLETED",
        publishedAt: new Date(serviceAt.getTime() - 5 * DAY_MS), completedAt: isUpcoming ? null : endedAt,
        slideThemeId: "slide-theme-default",
      },
    });
    await prisma.serviceItem.createMany({ data: serviceItems(servicePlanId, index, topics[index], scriptures[index]) });

    for (let slotIndex = 0; slotIndex < slotDefinitions.length; slotIndex += 1) {
      const slot = slotDefinitions[slotIndex];
      const serviceSlotId = `${servicePlanId}-slot-${slot.key}`;
      await prisma.serviceSlot.create({
        data: { id: serviceSlotId, churchId: church.id, servicePlanId, ministryRoleId: slot.roleId, name: slot.name, sortOrder: slotIndex + 1 },
      });
      const primaryKey = rotate(slot.primary, index);
      let backupKey = rotate(slot.backup, index);
      if (backupKey === primaryKey) backupKey = rotate(slot.backup, index + 1);
      await prisma.serviceAssignment.createMany({
        data: [
          { id: `${serviceSlotId}-primary`, churchId: church.id, serviceSlotId, personId: memberId(primaryKey), kind: "PRIMARY", status: isUpcoming ? "CONFIRMED" : "COMPLETED", confirmedAt: new Date(serviceAt.getTime() - 4 * DAY_MS), endedAt: isUpcoming ? null : endedAt },
          { id: `${serviceSlotId}-backup`, churchId: church.id, serviceSlotId, personId: memberId(backupKey), kind: "BACKUP", status: isUpcoming ? "CONFIRMED" : "COMPLETED", confirmedAt: new Date(serviceAt.getTime() - 3 * DAY_MS), endedAt: isUpcoming ? null : endedAt },
        ],
      });
    }

    const attendanceSessionId = `demo-attendance-${key}`;
    await prisma.attendanceSession.create({
      data: {
        id: attendanceSessionId, churchId: church.id, servicePlanId, title: `Servicio dominical: ${topics[index]}`,
        serviceAt, qrToken: `demo-${dateKey(serviceAt)}-${randomBytes(18).toString("hex")}`,
        manualCode: `GR${key}-${1000 + index}`, status: isUpcoming ? "OPEN" : "CLOSED",
        expiresAt: new Date(serviceAt.getTime() + 12 * 60 * 60 * 1000), closedAt: isUpcoming ? null : new Date(serviceAt.getTime() + 2 * 60 * 60 * 1000),
      },
    });

    if (!isUpcoming) {
      const selectedMembers = Array.from({ length: memberCounts[index] }, (_, offset) => members[(offset + index * 3) % members.length]);
      const eligibleVisitors = visitors.filter((visitor) => visitor.firstSeen <= index);
      const selectedVisitors = Array.from({ length: visitorCounts[index] }, (_, offset) => eligibleVisitors[(offset + index) % eligibleVisitors.length]);
      const attendees = [...selectedMembers, ...selectedVisitors];
      await prisma.attendanceRecord.createMany({
        data: attendees.map((person, attendeeIndex) => ({
          id: `${attendanceSessionId}-record-${String(attendeeIndex + 1).padStart(2, "0")}`,
          sessionId: attendanceSessionId, personId: person.id, source: attendeeIndex % 4 === 0 ? "MANUAL" : "QR",
          checkedInAt: new Date(serviceAt.getTime() + (attendeeIndex + 1) * 45 * 1000),
          notes: attendeeIndex === 0 && index % 3 === 0 ? "Registro realizado por el equipo de bienvenida." : null,
        })),
      });
    }
  }

  await prisma.notification.createMany({
    data: [
      { id: "notification-demo-pastor", churchId: church.id, userId: "user-pastor", title: "Servicio confirmado", body: "Tu asignacion como titular para el proximo servicio esta confirmada.", href: "/services/demo-service-11?tab=equipo" },
      { id: "notification-demo-presenter", churchId: church.id, userId: "user-presenter", title: "Contenido disponible", body: "Ya puedes revisar el contenido y preparar la presentacion del proximo domingo.", href: "/services/demo-service-11?tab=contenido" },
    ],
  });

  const summary = {
    church: church.name,
    services: serviceDates.length,
    completedServices: serviceDates.length - 1,
    people: people.length,
    members: members.length,
    visitors: visitors.length,
    mediaAssets: 0,
    adminLogin: "elena@grace.example",
    memberLogins: ["samuel@grace.example", "marco@grace.example", "andres@grace.example"],
  };
  console.log("Demo seed complete:", summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
