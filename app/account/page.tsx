import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { requireUser } from "@/lib/auth";
import { changeOwnPasswordAction } from "@/lib/user-actions";

export default async function AccountPage() {
  const user = await requireUser();
  return <><PageHeader title="Mi cuenta" subtitle="Consulta tu perfil y administra la seguridad de acceso." /><section className="content grid two"><div className="panel"><h2>Perfil</h2><p><strong>{user.name}</strong></p><p className="muted">{user.email}</p><span className="tag">{user.role === "ADMIN" ? "Administrador" : "Miembro"}</span></div><ActionForm action={changeOwnPasswordAction} className="panel form-grid"><h2>Cambiar contraseña</h2><div className="field"><label htmlFor="new-password">Nueva contraseña</label><input autoComplete="new-password" id="new-password" maxLength={128} minLength={8} name="password" required type="password" /></div><p className="muted">Al cambiar la contraseña se cerrarán todas tus sesiones activas.</p><button className="button primary" type="submit">Cambiar contraseña</button></ActionForm></section></>;
}
