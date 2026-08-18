export const dynamic = "force-dynamic";

export default async function ManualCheckInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="check-in-page"><header className="check-in-brand"><span>ChurchAdmin</span><h1>Registro de asistencia</h1><p>Ingresa el código que aparece debajo del QR del servicio.</p></header><section className="check-in-card"><form action="/check-in/manual" className="form-grid manual-code-form" method="post"><div className="field"><label htmlFor="manual-check-in-code">Código del servicio</label><input autoCapitalize="characters" autoComplete="off" autoCorrect="off" id="manual-check-in-code" inputMode="text" maxLength={9} name="code" pattern="[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}" placeholder="AB3D-K7M2" required /></div>{error ? <p className="form-error" role="alert">{error === "rate-limited" ? "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." : "El código no está disponible. Revísalo o solicita ayuda a un voluntario."}</p> : null}<button className="button primary check-in-submit" type="submit">Continuar</button></form></section></main>;
}
