import type { ExportKind, ExportStatus, Permission, PersonStatus, PersonType, ServiceItemType } from "@/lib/domain";

export type ServiceWorkspaceTab = "resumen" | "equipo" | "contenido" | "asistencia" | "exportaciones";
export type ServicesView = "calendar" | "list" | "mine";

export const serviceStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const assignmentStatusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "Por confirmar",
  CONFIRMED: "Confirmado",
  DECLINED: "Rechazado",
  REPLACED: "Reemplazado",
  COMPLETED: "Completado",
};

export const personStatusLabels: Record<PersonStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  FOLLOW_UP: "Seguimiento",
};

export const personTypeLabels: Record<PersonType, string> = {
  MEMBER: "Miembro",
  VISITOR: "Visitante",
};

export const serviceItemTypeLabels: Record<ServiceItemType, string> = {
  SONG: "Canción",
  SCRIPTURE: "Escritura",
  ANNOUNCEMENT: "Anuncio",
  SERMON_NOTE: "Nota de sermón",
  PRAYER: "Oración",
  MEDIA_CUE: "Indicación multimedia",
  CUSTOM_TEXT: "Texto personalizado",
};

export const exportKindLabels: Record<ExportKind, string> = {
  SLIDE_IMAGES: "Imágenes de diapositivas",
  TEXT_PDF: "PDF de textos",
  RUN_SHEET_PDF: "Guion del servicio",
  PROPRESENTER_PACKAGE: "Paquete ProPresenter",
};

export const exportStatusLabels: Record<ExportStatus, string> = {
  PENDING: "En espera",
  PROCESSING: "Procesando",
  COMPLETE: "Listo",
  FAILED: "Falló",
  CANCELLED: "Cancelado",
};

export type PermissionGroup = "Asistencia" | "Personas" | "Servicios" | "Multimedia" | "Comunicaciones" | "Ofrendas" | "Programación" | "Administración";

export const permissionMetadata: Record<Permission, { group: PermissionGroup; label: string; description: string }> = {
  "attendance.checkin.manual": { group: "Asistencia", label: "Registrar asistencia", description: "Agregar registros manuales durante un servicio." },
  "attendance.sessions.manage": { group: "Asistencia", label: "Administrar sesiones", description: "Abrir, cerrar y configurar sesiones de asistencia." },
  "attendance.history.view": { group: "Asistencia", label: "Consultar historial", description: "Ver sesiones y registros anteriores." },
  "attendance.analytics.view": { group: "Asistencia", label: "Consultar tendencias", description: "Ver gráficas y exportar datos analíticos." },
  "people.view": { group: "Personas", label: "Consultar personas", description: "Ver el directorio de miembros y visitantes." },
  "people.manage": { group: "Personas", label: "Administrar personas", description: "Crear, editar y combinar perfiles." },
  "services.view": { group: "Servicios", label: "Consultar servicios", description: "Ver servicios y su orden de contenido." },
  "services.content.edit": { group: "Servicios", label: "Editar contenido", description: "Preparar canciones, lecturas y anuncios." },
  "services.present": { group: "Servicios", label: "Presentar servicio", description: "Usar el contenido durante el servicio." },
  "services.export": { group: "Servicios", label: "Generar exportaciones", description: "Crear PDFs, imágenes y paquetes ProPresenter." },
  "media.manage": { group: "Multimedia", label: "Administrar multimedia", description: "Subir, consultar y retirar archivos." },
  "communications.view": { group: "Comunicaciones", label: "Consultar comunicaciones", description: "Ver campañas, calendario y resultados." },
  "communications.create": { group: "Comunicaciones", label: "Preparar campañas", description: "Crear borradores y editar contenido." },
  "communications.approve": { group: "Comunicaciones", label: "Aprobar campañas", description: "Autorizar contenido antes de programarlo." },
  "communications.publish": { group: "Comunicaciones", label: "Publicar campañas", description: "Programar, cancelar y enviar publicaciones." },
  "communications.connections.manage": { group: "Comunicaciones", label: "Administrar conexiones", description: "Configurar cuentas y credenciales oficiales." },
  "communications.consent.manage": { group: "Comunicaciones", label: "Administrar consentimientos", description: "Registrar altas y bajas de WhatsApp." },
  "offerings.capture": { group: "Ofrendas", label: "Capturar ofrendas", description: "Registrar cierres y consultar capturas propias del mes actual." },
  "offerings.audit.view": { group: "Ofrendas", label: "Auditar ofrendas", description: "Ver historial, tendencias, auditoría y exportaciones sin modificar cierres." },
  "offerings.view": { group: "Ofrendas", label: "Consultar ofrendas (anterior)", description: "Permiso anterior compatible con auditoría." },
  "offerings.manage": { group: "Ofrendas", label: "Administrar ofrendas (anterior)", description: "Permiso anterior compatible con captura y auditoría." },
  "schedule.view.own": { group: "Programación", label: "Ver mi calendario", description: "Consultar asignaciones propias." },
  "schedule.propose": { group: "Programación", label: "Proponerse para servir", description: "Solicitar puestos compatibles disponibles." },
  "schedule.manage": { group: "Programación", label: "Coordinar equipos", description: "Asignar titulares, respaldos y publicar servicios." },
  "ministry.manage": { group: "Administración", label: "Configurar ministerios", description: "Definir cargos, elegibilidad y plantillas." },
  "theme.manage": { group: "Administración", label: "Configurar apariencia", description: "Administrar marca, temas y exportación." },
  "users.manage": { group: "Administración", label: "Administrar cuentas", description: "Invitar, editar y desactivar usuarios." },
};

export function formatServiceDate(value: Date | string, timeZone: string, includeTime = true) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone,
  }).format(new Date(value));
}
