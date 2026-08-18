import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, FileOutput, ListChecks, QrCode, Share2, Users, type LucideIcon } from "lucide-react";
import { ServicesClient } from "@/components/ServicesClient";
import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { ServiceStatusActions } from "@/components/ServiceStatusActions";
import { requireUser } from "@/lib/auth";
import { listContentLibrary } from "@/lib/content-library-actions";
import { getExportJobs } from "@/lib/export-actions";
import { canAccess, hasServicePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { applySlotTemplatesAction, assignServiceSlotAction, promoteBackupAction, proposeForSlotAction, rejectProposalAction, respondToAssignmentAction, withdrawProposalAction } from "@/lib/schedule-actions";
import { assignmentStatusLabels, formatServiceDate, serviceStatusLabels, type ServiceWorkspaceTab } from "@/lib/ui-labels";
import { redirect } from "next/navigation";

const tabs: Array<{ value: ServiceWorkspaceTab; label: string }> = [
  { value: "resumen", label: "Resumen" },
  { value: "equipo", label: "Equipo" },
  { value: "contenido", label: "Contenido" },
  { value: "asistencia", label: "Asistencia" },
  { value: "exportaciones", label: "Exportaciones" },
];

export default async function ServiceWorkspacePage({ params, searchParams }: { params: Promise<{ servicePlanId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { servicePlanId } = await params;
  const query = await searchParams;
  const tab = tabs.some((item) => item.value === query.tab) ? query.tab as ServiceWorkspaceTab : "resumen";
  const manages = canAccess(user, "schedule.manage");
  const canView = manages || canAccess(user, "services.view") || canAccess(user, "schedule.view.own") || canAccess(user, "schedule.propose") || await hasServicePermission(user, "services.view", servicePlanId);
  if (!canView) redirect("/services?view=mine");

  const service = await prisma.servicePlan.findFirst({
    where: { id: servicePlanId, churchId: user.churchId },
    include: {
      slideTheme: { select: { name: true } },
      attendanceSession: { select: { id: true, status: true, expiresAt: true } },
      items: { orderBy: { sortOrder: "asc" } },
      serviceSlots: { include: { ministryRole: true, proposals: { include: { person: true }, orderBy: { createdAt: "asc" } }, assignments: { include: { person: true }, orderBy: { createdAt: "desc" } } }, orderBy: { sortOrder: "asc" } },
      exportJobs: { where: { status: "COMPLETE" }, select: { id: true }, take: 1 },
    },
  });
  if (!service) redirect("/services");
  if (!manages && !canAccess(user, "services.view") && service.status !== "PUBLISHED") redirect("/services?view=mine");

  const church = await prisma.church.findUniqueOrThrow({ where: { id: user.churchId }, select: { timeZone: true } });
  const [people, templateCount] = manages ? await Promise.all([
    prisma.person.findMany({ where: { churchId: user.churchId, personType: "MEMBER", status: "ACTIVE" }, include: { ministryMemberships: { where: { isActive: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.serviceSlotTemplate.count({ where: { churchId: user.churchId, isActive: true } }),
  ]) : [[], 0];
  const eligibleRoleIds = user.personId ? (await prisma.ministryMembership.findMany({ where: { churchId: user.churchId, personId: user.personId, isActive: true }, select: { ministryRoleId: true } })).map((membership) => membership.ministryRoleId) : [];
  const canEditContent = canAccess(user, "services.content.edit") || await hasServicePermission(user, "services.content.edit", service.id);
  const canExport = canAccess(user, "services.export") || await hasServicePermission(user, "services.export", service.id);
  const canCheckIn = Boolean(service.attendanceSession) && (canAccess(user, "attendance.checkin.manual") || await hasServicePermission(user, "attendance.checkin.manual", service.id));
  if (tab === "contenido" && !canEditContent) redirect(`/services/${service.id}?tab=resumen`);
  if (tab === "exportaciones" && !canExport) redirect(`/services/${service.id}?tab=resumen`);

  const visibleAssignment = (status: string) => ["PENDING_CONFIRMATION", "CONFIRMED", "COMPLETED"].includes(status);
  const activeAssignment = (status: string) => ["PENDING_CONFIRMATION", "CONFIRMED"].includes(status);
  const staffed = service.serviceSlots.filter((slot) => slot.assignments.some((assignment) => assignment.kind === "PRIMARY" && visibleAssignment(assignment.status))).length;
  const confirmed = service.serviceSlots.filter((slot) => slot.assignments.some((assignment) => assignment.kind === "PRIMARY" && assignment.status === "CONFIRMED")).length;
  const duration = service.items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);

  return <>
    <PageHeader title={service.title} subtitle={formatServiceDate(service.serviceAt, church.timeZone)} actions={<div className="actions"><span className={`status-badge status-${service.status.toLowerCase()}`}>{serviceStatusLabels[service.status]}</span>{canAccess(user, "communications.create") ? <Link className="button" href={`/communications?view=campaigns&servicePlanId=${service.id}#new-campaign`}><Share2 />Compartir grabación</Link> : null}{manages ? <ServiceStatusActions servicePlanId={service.id} status={service.status} /> : null}<Link className="button" href="/services">Volver a servicios</Link></div>} />
    <nav aria-label="Secciones del servicio" className="workspace-tabs">{tabs.filter((item) => item.value !== "contenido" || canEditContent).filter((item) => item.value !== "exportaciones" || canExport).map((item) => <Link aria-current={tab === item.value ? "page" : undefined} className={tab === item.value ? "active" : ""} href={`/services/${service.id}?tab=${item.value}`} key={item.value}>{item.label}</Link>)}</nav>

    {tab === "resumen" ? <section className="content service-summary-layout">
      <div className="readiness-hero"><div><span className="eyebrow">Preparación del servicio</span><h2>{service.topic || "Tema por definir"}</h2><p>{service.slideTheme?.name ? `Tema visual: ${service.slideTheme.name}` : "Usa el tema visual predeterminado de la iglesia."}</p></div><div className="readiness-score"><strong>{[service.items.length > 0, staffed === service.serviceSlots.length && staffed > 0, service.status === "PUBLISHED", Boolean(service.attendanceSession)].filter(Boolean).length}/4</strong><span>áreas preparadas</span></div></div>
      <div className="readiness-grid">
        <ReadinessCard icon={ListChecks} title="Contenido" value={`${service.items.length} elementos`} detail={`${duration} minutos estimados`} ready={service.items.length > 0} href={`/services/${service.id}?tab=contenido`} />
        <ReadinessCard icon={Users} title="Equipo" value={`${staffed}/${service.serviceSlots.length} puestos`} detail={`${confirmed} titulares confirmados`} ready={staffed === service.serviceSlots.length && staffed > 0} href={`/services/${service.id}?tab=equipo`} />
        <ReadinessCard icon={QrCode} title="Asistencia" value={service.attendanceSession ? service.attendanceSession.status === "OPEN" ? "Sesión abierta" : "Sesión cerrada" : "Sin sesión"} detail={canCheckIn ? "Registro manual disponible" : "Configura la sesión de asistencia"} ready={Boolean(service.attendanceSession)} href={`/services/${service.id}?tab=asistencia`} />
        <ReadinessCard icon={FileOutput} title="Exportaciones" value={service.exportJobs.length ? "Archivos listos" : "Sin exportar"} detail="PDF, imágenes y ProPresenter" ready={service.exportJobs.length > 0} href={canExport ? `/services/${service.id}?tab=exportaciones` : undefined} />
      </div>
      <div className="summary-band"><div><h2>Siguientes acciones</h2><p>Resuelve los pendientes antes de publicar o comenzar el servicio.</p></div><div className="action-checklist">{!service.items.length ? <ActionWarning text="Agrega el orden y contenido del servicio." href={`/services/${service.id}?tab=contenido`} /> : null}{staffed < service.serviceSlots.length ? <ActionWarning text={`${service.serviceSlots.length - staffed} puestos todavía no tienen titular.`} href={`/services/${service.id}?tab=equipo`} /> : null}{service.status === "DRAFT" ? <ActionWarning text="Publica el servicio cuando el equipo deba confirmar." /> : null}{!service.attendanceSession ? <ActionWarning text="Crea o vincula una sesión de asistencia." href={`/services/${service.id}?tab=asistencia`} /> : null}{service.items.length && staffed === service.serviceSlots.length && service.status !== "DRAFT" && service.attendanceSession ? <p className="ready-message"><CheckCircle2 />El servicio tiene sus áreas principales preparadas.</p> : null}</div></div>
    </section> : null}

    {tab === "equipo" ? <section className="content"><div className="team-heading"><div><h2>Equipo de servicio</h2><p>Un titular y un respaldo pueden permanecer activos por cada puesto.</p></div><span className="status-badge">{staffed}/{service.serviceSlots.length} cubiertos</span></div>{!service.serviceSlots.length ? <div className="empty-state page-empty"><Users /><h2>No hay puestos configurados</h2><p>Aplica las plantillas habituales o configúralas desde Ministerios.</p>{manages && templateCount ? <ActionForm action={applySlotTemplatesAction}><input name="servicePlanId" type="hidden" value={service.id} /><button className="button primary" type="submit">Aplicar plantillas</button></ActionForm> : <Link className="button" href="/ministry?view=templates">Configurar plantillas</Link>}</div> : <div className="team-table">{service.serviceSlots.map((slot) => {
      const primary = slot.assignments.find((assignment) => assignment.kind === "PRIMARY" && visibleAssignment(assignment.status));
      const backup = slot.assignments.find((assignment) => assignment.kind === "BACKUP" && visibleAssignment(assignment.status));
      const candidates = people.filter((person) => person.ministryMemberships.some((membership) => membership.ministryRoleId === slot.ministryRoleId));
      const proposals = slot.proposals.filter((proposal) => proposal.status === "PENDING");
      const myProposal = proposals.find((proposal) => proposal.personId === user.personId);
      const pendingAssignmentIds = [primary, backup].filter((assignment) => assignment?.personId === user.personId && activeAssignment(assignment?.status ?? "") && assignment?.status === "PENDING_CONFIRMATION").map((assignment) => assignment!.id);
      return <article className="team-row" key={slot.id}><div className="team-position"><span className="ministry-color" style={{ backgroundColor: slot.ministryRole.color }} /><div><strong>{slot.name}</strong><small>{slot.ministryRole.name}</small></div></div><AssignmentCell assignment={primary} label="Titular" /><AssignmentCell assignment={backup} label="Respaldo" /><div className="team-proposals"><strong>{proposals.length}</strong><span>propuestas</span></div><MemberSlotActions canPropose={canAccess(user, "schedule.propose")} eligible={eligibleRoleIds.includes(slot.ministryRoleId)} pendingAssignmentIds={pendingAssignmentIds} proposalId={myProposal?.id} serviceIsPublished={service.status === "PUBLISHED"} serviceSlotId={slot.id} slotAvailable={!primary} />{manages && ["DRAFT", "PUBLISHED"].includes(service.status) ? candidates.length ? <details className="team-actions"><summary>Asignar</summary><div>{(["PRIMARY", "BACKUP"] as const).map((kind) => <ActionForm action={assignServiceSlotAction} key={kind} successMessage="La invitación fue enviada."><input name="serviceSlotId" type="hidden" value={slot.id} /><input name="kind" type="hidden" value={kind} /><label>{kind === "PRIMARY" ? "Nuevo titular" : "Nuevo respaldo"}<select name="personId" required>{candidates.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select></label><button className="button" type="submit">Enviar invitación</button></ActionForm>)}{backup?.status === "CONFIRMED" ? <ActionForm action={promoteBackupAction} confirmMessage="¿Promover al respaldo confirmado como nuevo titular?"><input name="serviceSlotId" type="hidden" value={slot.id} /><button className="button primary" type="submit">Promover respaldo</button></ActionForm> : null}</div></details> : <div className="eligibility-empty"><span>Sin miembros elegibles</span><Link href={`/ministry?view=members&roleId=${slot.ministryRoleId}`}>Configurar</Link></div> : null}{proposals.map((proposal) => <div className="proposal-row" key={proposal.id}><span>{proposal.person.firstName} {proposal.person.lastName}</span><ActionForm action={assignServiceSlotAction}><input name="serviceSlotId" type="hidden" value={slot.id} /><input name="personId" type="hidden" value={proposal.personId} /><button className="button" name="kind" type="submit" value="PRIMARY">Titular</button><button className="button" name="kind" type="submit" value="BACKUP">Respaldo</button></ActionForm><ActionForm action={rejectProposalAction} confirmMessage={`¿Rechazar la propuesta de ${proposal.person.firstName}?`}><input name="proposalId" type="hidden" value={proposal.id} /><button className="button danger" type="submit">Rechazar</button></ActionForm></div>)}</article>;
    })}</div>}</section> : null}

    {tab === "contenido" ? <ServicesClient embedded initialExportJobs={[]} initialLibraryItems={await listContentLibrary()} section="content" servicePlanId={service.id} /> : null}
    {tab === "exportaciones" ? <ServicesClient embedded initialExportJobs={await getExportJobs()} initialLibraryItems={[]} section="exports" servicePlanId={service.id} /> : null}
    {tab === "asistencia" ? <section className="content"><div className="attendance-service-band"><div><QrCode /><span className="eyebrow">Asistencia vinculada</span><h2>{service.attendanceSession ? service.attendanceSession.status === "OPEN" ? "La sesión está abierta" : "La sesión está cerrada" : "Este servicio no tiene una sesión"}</h2><p>{service.attendanceSession ? "Abre el módulo de asistencia para registrar personas, mostrar el QR o consultar el detalle." : "Crea una sesión de asistencia y vincúlala con este servicio."}</p></div><Link className="button primary" href={service.attendanceSession ? `/attendance?view=check-in&sessionId=${service.attendanceSession.id}` : `/attendance?servicePlanId=${service.id}`}>{service.attendanceSession ? "Abrir check-in" : "Configurar asistencia"}</Link></div></section> : null}
  </>;
}

function ReadinessCard({ icon: Icon, title, value, detail, ready, href }: { icon: LucideIcon; title: string; value: string; detail: string; ready: boolean; href?: string }) {
  const content = <><span className={ready ? "readiness-icon ready" : "readiness-icon"}>{ready ? <CheckCircle2 /> : <Icon />}</span><div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div></>;
  return href ? <Link className="readiness-card" href={href}>{content}</Link> : <div className="readiness-card">{content}</div>;
}

function ActionWarning({ text, href }: { text: string; href?: string }) {
  const content = <><AlertTriangle /><span>{text}</span>{href ? <span className="action-link">Resolver</span> : null}</>;
  return href ? <Link className="action-warning" href={href}>{content}</Link> : <div className="action-warning">{content}</div>;
}

function AssignmentCell({ label, assignment }: { label: string; assignment?: { person: { firstName: string; lastName: string }; status: string } }) {
  return <div className="assignment-cell"><small>{label}</small>{assignment ? <><strong>{assignment.person.firstName} {assignment.person.lastName}</strong><span><CircleDashed />{assignmentStatusLabels[assignment.status] ?? assignment.status}</span></> : <><strong>Sin asignar</strong><span><Clock3 />Disponible</span></>}</div>;
}

function MemberSlotActions({ canPropose, eligible, pendingAssignmentIds, proposalId, serviceIsPublished, serviceSlotId, slotAvailable }: { canPropose: boolean; eligible: boolean; pendingAssignmentIds: string[]; proposalId?: string; serviceIsPublished: boolean; serviceSlotId: string; slotAvailable: boolean }) {
  if (pendingAssignmentIds.length) return <div className="member-slot-actions">{pendingAssignmentIds.map((assignmentId) => <ActionForm action={respondToAssignmentAction} className="actions" key={assignmentId}><input name="assignmentId" type="hidden" value={assignmentId} /><button className="button primary" name="response" type="submit" value="CONFIRMED">Confirmar</button><button className="button danger" name="response" type="submit" value="DECLINED">Declinar</button></ActionForm>)}</div>;
  if (proposalId) return <ActionForm action={withdrawProposalAction} className="member-slot-actions" confirmMessage="¿Retirar tu propuesta para este puesto?"><input name="proposalId" type="hidden" value={proposalId} /><span className="status-badge">Propuesta enviada</span><button className="button" type="submit">Retirar</button></ActionForm>;
  if (canPropose && eligible && serviceIsPublished && slotAvailable) return <ActionForm action={proposeForSlotAction} className="member-slot-actions" successMessage="Tu propuesta fue enviada."><input name="serviceSlotId" type="hidden" value={serviceSlotId} /><button className="button" type="submit">Proponerme</button></ActionForm>;
  return null;
}
