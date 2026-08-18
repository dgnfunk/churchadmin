import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { createUserAction, getUsers, resetUserPasswordAction, revokeUserSessionsAction, updateUserAction } from "@/lib/user-actions";

export default async function UsersPage() {
  const { users, people } = await getUsers();

  return <>
    <PageHeader title="Usuarios" subtitle="Administra cuentas; los cargos ministeriales definen el acceso operativo." actions={<a className="button primary" href="#create-user">Invitar miembro</a>} />
    <section className="content grid two">
      <div className="grid">{users.map((user) => <details className="panel user-editor" key={user.id}>
        <summary><span><strong>{user.name}</strong><small>{user.email}</small></span><span className={user.isActive ? (user.role === "ADMIN" ? "tag gold" : "tag") : "tag inactive"}>{user.isActive ? (user.role === "ADMIN" ? "Administrador" : "Miembro") : "Inactiva"}</span></summary>
        <ActionForm action={updateUserAction} className="form-grid" successMessage="La cuenta se actualizó correctamente.">
          <input name="userId" type="hidden" value={user.id} />
          <div className="field"><label>Nombre<input maxLength={120} minLength={2} name="name" defaultValue={user.name} required /></label></div>
          <div className="field"><label>Tipo de cuenta<select name="role" defaultValue={user.role}><option value="ADMIN">Administrador</option><option value="MEMBER">Miembro</option></select></label></div>
          <div className="field"><label>Persona vinculada<select name="personId" defaultValue={user.personId ?? ""}><option value="">Sin vincular</option>{people.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select></label></div>
          {user.person?.ministryMemberships.length ? <p className="muted">Cargos: {user.person.ministryMemberships.map((membership) => membership.ministryRole.name).join(", ")}</p> : null}
          <label className="toggle-row"><input defaultChecked={user.isActive} name="isActive" type="checkbox" />Cuenta activa</label>
          <button className="button primary" type="submit">Guardar cuenta</button>
        </ActionForm>
        <div className="user-security">
          <ActionForm action={resetUserPasswordAction} className="actions" confirmMessage="¿Restablecer la contraseña y cerrar todas las sesiones de esta cuenta?" successMessage="La contraseña temporal se actualizó.">
            <input name="userId" type="hidden" value={user.id} />
            <input aria-label={`Nueva contraseña temporal para ${user.name}`} autoComplete="new-password" maxLength={128} minLength={8} name="password" placeholder="Contraseña temporal" required type="password" />
            <button className="button" type="submit">Restablecer contraseña</button>
          </ActionForm>
          <ActionForm action={revokeUserSessionsAction} confirmMessage="¿Cerrar todas las sesiones activas de esta cuenta?" successMessage="Las sesiones fueron revocadas.">
            <input name="userId" type="hidden" value={user.id} />
            <button className="button danger" type="submit">Revocar sesiones</button>
          </ActionForm>
        </div>
      </details>)}</div>
      <aside className="panel" id="create-user">
        <h2>Invitar cuenta</h2>
        <ActionForm action={createUserAction} className="form-grid" successMessage="La cuenta se creó correctamente.">
          <div className="field"><label>Nombre<input autoComplete="name" maxLength={120} minLength={2} name="name" required /></label></div>
          <div className="field"><label>Email<input autoComplete="email" maxLength={254} name="email" required type="email" /></label></div>
          <div className="field"><label>Contraseña temporal<input autoComplete="new-password" maxLength={128} minLength={8} name="password" required type="password" /></label></div>
          <div className="field"><label>Tipo de cuenta<select name="role" defaultValue="MEMBER"><option value="MEMBER">Miembro</option><option value="ADMIN">Administrador</option></select></label></div>
          <div className="field"><label>Persona vinculada<select name="personId"><option value="">Seleccionar miembro</option>{people.filter((person) => !person.user).map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select></label></div>
          <p className="muted">La contraseña temporal deberá cambiarse al iniciar sesión.</p>
          <button className="button primary" type="submit">Crear cuenta</button>
        </ActionForm>
      </aside>
    </section>
  </>;
}
