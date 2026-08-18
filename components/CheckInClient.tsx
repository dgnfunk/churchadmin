"use client";

import { useEffect, useState, type FormEvent } from "react";

type Result = { firstName: string; alreadyCheckedIn: boolean; checkedInAt: string };

export function CheckInClient({ qrToken, hasIdentity }: { qrToken: string; hasIdentity: boolean }) {
  const [mode, setMode] = useState<"existing" | "visitor">("existing");
  const [checking, setChecking] = useState(hasIdentity);
  const [needsIdentity, setNeedsIdentity] = useState(!hasIdentity);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasIdentity) return;
    let active = true;
    void fetch(`/check-in/api/${encodeURIComponent(qrToken)}`, { method: "POST", headers: { "Content-Type": "application/json" } })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!active) return;
        if (response.status === 401) { setNeedsIdentity(true); setChecking(false); return; }
        if (!response.ok) throw new Error(body.error ?? "No pudimos registrar tu asistencia.");
        setResult(body); setChecking(false);
      }).catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : "No pudimos registrar tu asistencia."); setChecking(false); } });
    return () => { active = false; };
  }, [hasIdentity, qrToken]);

  async function identify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setChecking(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/check-in/api/${encodeURIComponent(qrToken)}/identify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, contact: data.get("contact"), name: data.get("name"), whatsappConsent: data.get("whatsappConsent") === "on" })
    });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "No pudimos registrar tu asistencia."); setChecking(false); return; }
    setResult(body); setNeedsIdentity(false); setChecking(false);
  }

  if (result) return <div className="check-in-result" role="status"><div className="success-mark">✓</div><h2>{result.alreadyCheckedIn ? "Ya habías registrado tu asistencia" : "Asistencia registrada"}</h2><p>{result.firstName}, tu asistencia quedó registrada.</p><small>{new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(result.checkedInAt))}</small><form action="/check-in/api/forget" method="post"><button className="text-button" type="submit">No soy yo · olvidar este dispositivo</button></form></div>;
  if (checking) return <div className="check-in-result" role="status"><span className="check-in-spinner" /><h2>Registrando tu asistencia</h2><p>Tomará solo un momento.</p></div>;
  if (!needsIdentity) return null;
  return <div className="identity-panel"><div className="segmented check-in-modes"><button className={mode === "existing" ? "active" : ""} onClick={() => { setMode("existing"); setError(""); }} type="button">Ya he asistido</button><button className={mode === "visitor" ? "active" : ""} onClick={() => { setMode("visitor"); setError(""); }} type="button">Primera visita</button></div><form aria-busy={checking} className="form-grid check-in-form" onSubmit={identify}>{mode === "visitor" ? <div className="field"><label htmlFor="attendee-name">Nombre completo</label><input autoComplete="name" id="attendee-name" maxLength={160} minLength={2} name="name" required /></div> : null}<div className="field"><label htmlFor="attendee-contact">Correo o teléfono</label><input autoComplete="email tel" id="attendee-contact" maxLength={254} name="contact" required /></div><label className="toggle-row"><input name="whatsappConsent" type="checkbox" />Acepto recibir por WhatsApp anuncios de servicios y transmisiones. Puedo responder BAJA en cualquier momento.</label>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button primary check-in-submit" disabled={checking} type="submit">{checking ? "Registrando…" : "Registrar asistencia"}</button></form></div>;
}
