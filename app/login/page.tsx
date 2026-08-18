import { PageHeader } from "@/components/PageHeader";
import { loginAction } from "@/lib/auth-actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <>
      <PageHeader title="Iniciar sesión" subtitle="Accede con tu cuenta administrativa o de miembro." />
      <section className="content">
        <div className="panel" style={{ maxWidth: 520 }}>
          <h2>Acceso a ChurchAdmin</h2>
          {error === "invalid" ? <div className="notice">El correo o la contraseña no son correctos.</div> : null}
          <form action={loginAction} className="form-grid">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input autoComplete="email" id="email" maxLength={254} name="email" placeholder="elena@grace.example" required type="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input autoComplete="current-password" id="password" maxLength={128} name="password" required type="password" />
            </div>
            <button className="button primary" type="submit">Ingresar</button>
          </form>
        </div>
      </section>
    </>
  );
}
