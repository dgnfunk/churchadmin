import Link from "next/link";
import { Plus, ShieldCheck, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { DetailsCancelButton } from "@/components/DetailsCancelButton";
import { MinistryMembershipEditor } from "@/components/MinistryMembershipEditor";
import { createMinistryRolePresetAction, getMinistryManagementData, saveMinistryRoleAction, saveSlotTemplateAction } from "@/lib/ministry-actions";
import { ministryRolePresets, type MinistryRolePresetKey } from "@/lib/ministry-role-presets";
import { permissions } from "@/lib/permissions";
import { permissionMetadata, type PermissionGroup } from "@/lib/ui-labels";

type MinistryView = "roles" | "members" | "templates";
const groups: PermissionGroup[] = ["Asistencia", "Personas", "Servicios", "Multimedia", "Comunicaciones", "Ofrendas", "Programación", "Administración"];

export default async function MinistryPage({ searchParams }: { searchParams: Promise<{ view?: string; roleId?: string }> }) {
  const params = await searchParams;
  const view: MinistryView = params.view === "members" || params.view === "templates" ? params.view : "roles";
  const { roles, people, templates } = await getMinistryManagementData();
  const tabs = [{ value: "roles", label: "Cargos", icon: ShieldCheck }, { value: "members", label: "Miembros", icon: Users }, { value: "templates", label: "Plantillas de puestos", icon: UserCheck }] as const;
  const existingRoleNames = new Set(roles.map((role) => role.name.trim().toLocaleLowerCase("es-MX")));
  const missingPresets = (Object.keys(ministryRolePresets) as MinistryRolePresetKey[]).filter((preset) => !existingRoleNames.has(ministryRolePresets[preset].name.toLocaleLowerCase("es-MX")));

  return <>
    <PageHeader title="Ministerios" subtitle="Define quién puede servir, en qué función y con qué acceso." actions={<nav aria-label="Secciones de ministerios" className="segmented">{tabs.map((item) => { const Icon = item.icon; return <Link aria-current={view === item.value ? "page" : undefined} className={view === item.value ? "active" : ""} href={`/ministry?view=${item.value}`} key={item.value}><Icon />{item.label}</Link>; })}</nav>} />
    <section className="content ministry-workspace">
      {view === "roles" ? <><div className="ministry-intro"><div><span className="eyebrow">Cargos ministeriales</span><h2>Permisos claros para cada responsabilidad</h2><p>Los permisos permanentes siempre están activos. Los permisos al servir solo se activan para una asignación titular confirmada en un servicio publicado.</p>{missingPresets.length ? <div className="actions">{missingPresets.map((preset) => <PresetButton key={preset} label={`Crear ${ministryRolePresets[preset].name}`} preset={preset} />)}</div> : null}</div><details className="create-drawer"><summary className="button primary"><Plus />Nuevo cargo</summary><RoleForm /></details></div><div className="role-list">{roles.map((role) => <details className="role-row" key={role.id}><summary><span className="ministry-color" style={{ backgroundColor: role.color }} /><div><strong>{role.name}</strong><p>{role.description || "Sin descripción"}</p></div><span>{role.memberships.filter((membership) => membership.isActive).length} miembros</span><span className={role.isActive ? "status-badge" : "status-badge inactive"}>{role.isActive ? "Activo" : "Inactivo"}</span></summary><RoleForm role={role} /></details>)}</div></> : null}

      {view === "members" ? <><div className="ministry-intro"><div><span className="eyebrow">Elegibilidad</span><h2>Miembros preparados para servir</h2><p>Selecciona una persona, asigna todos sus cargos y guarda los cambios una sola vez.</p></div></div><MinistryMembershipEditor people={people.map((person) => ({ id: person.id, name: `${person.firstName} ${person.lastName}`, contact: person.email || person.phone || "Sin contacto", assignedRoleIds: person.ministryMemberships.filter((membership) => membership.isActive).map((membership) => membership.ministryRoleId) }))} roles={roles.filter((role) => role.isActive).map((role) => ({ id: role.id, name: role.name, description: role.description || "Sin descripción", color: role.color, isOfferingRole: role.basePermissions.some((permission) => permission.startsWith("offerings.")) }))} /></> : null}

      {view === "templates" ? <><div className="ministry-intro"><div><span className="eyebrow">Plantillas de puestos</span><h2>El equipo habitual de cada semana</h2><p>Estos puestos se agregan automáticamente al crear un servicio. Las personas asignadas no se copian.</p></div><details className="create-drawer"><summary className="button primary"><Plus />Nueva plantilla</summary><ActionForm action={saveSlotTemplateAction} className="drawer-form" successMessage="La plantilla se guardó correctamente."><label>Puesto<input maxLength={100} minLength={2} name="name" placeholder="Ej. Guitarra" required /></label><label>Cargo requerido<select name="ministryRoleId" required><option value="">Selecciona un cargo</option>{roles.filter((role) => role.isActive).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><button className="button primary" type="submit">Guardar plantilla</button></ActionForm></details></div><div className="template-list">{templates.map((template, index) => <div className="template-row" key={template.id}><span className="order">{index + 1}</span><div><strong>{template.name}</strong><p>Requiere: {template.ministryRole.name}</p></div><span className={template.isActive ? "status-badge" : "status-badge inactive"}>{template.isActive ? "Activa" : "Inactiva"}</span></div>)}</div></> : null}
    </section>
  </>;
}

function RoleForm({ role }: { role?: { id: string; name: string; description: string | null; color: string; basePermissions: string[]; servicePermissions: string[]; isActive: boolean } }) {
  return <ActionForm action={saveMinistryRoleAction} className="role-editor" successMessage={role ? "El cargo se actualizó correctamente." : "El cargo se creó correctamente."}><div className="role-editor-heading"><div><span className="eyebrow">{role ? "Editar cargo" : "Nuevo cargo"}</span><h2>{role?.name ?? "Configura el nuevo cargo"}</h2></div><DetailsCancelButton iconOnly /></div><input name="roleId" type="hidden" value={role?.id ?? ""} /><div className="role-identity"><label>Nombre<input defaultValue={role?.name} maxLength={100} minLength={2} name="name" required /></label><label>Descripción<input defaultValue={role?.description ?? ""} maxLength={500} name="description" /></label><label>Color<input defaultValue={role?.color ?? "#0f766e"} name="color" type="color" /></label>{role ? <label className="toggle-row"><input defaultChecked={role.isActive} name="isActive" type="checkbox" />Cargo activo</label> : null}</div><div className="permission-columns"><PermissionSelection field="basePermissions" selected={role?.basePermissions ?? []} title="Permisos permanentes" description="Disponibles siempre para miembros con este cargo." /><PermissionSelection field="servicePermissions" selected={role?.servicePermissions ?? []} title="Permisos al servir" description="Solo para el titular confirmado durante el servicio." /></div><div className="editor-footer"><DetailsCancelButton /><button className="button primary" type="submit">{role ? "Guardar cambios" : "Crear cargo"}</button></div></ActionForm>;
}

function PermissionSelection({ field, selected, title, description }: { field: string; selected: string[]; title: string; description: string }) {
  const available = field === "servicePermissions" ? permissions.filter((permission) => !permission.startsWith("offerings.")) : permissions;
  return <fieldset className="permission-panel"><legend>{title}</legend><p>{description}</p>{groups.map((group) => { const grouped = available.filter((permission) => permissionMetadata[permission].group === group); return grouped.length ? <section key={group}><h3>{group}</h3>{grouped.map((permission) => <label key={`${field}-${permission}`}><input defaultChecked={selected.includes(permission)} name={field} type="checkbox" value={permission} /><span><strong>{permissionMetadata[permission].label}</strong><small>{permissionMetadata[permission].description}</small></span></label>)}</section> : null; })}</fieldset>;
}

function PresetButton({ label, preset }: { label: string; preset: MinistryRolePresetKey }) {
  return <ActionForm action={createMinistryRolePresetAction} successMessage="El cargo quedó disponible para asignar miembros."><input name="preset" type="hidden" value={preset} /><button className="button" type="submit">{label}</button></ActionForm>;
}
