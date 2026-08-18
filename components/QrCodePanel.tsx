"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { Download, Expand, MoreHorizontal, Printer, QrCode, X } from "lucide-react";
import { regenerateAttendanceQrAction } from "@/lib/people-attendance-actions";
import { ActionForm } from "@/components/ActionForm";

export function QrCodePanel({ sessionId, publicUrl, manualUrl, manualCode }: { sessionId: string; publicUrl: string; manualUrl: string; manualCode: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const source = `/api/attendance/${encodeURIComponent(sessionId)}/qr.png`;
  return <><div className="panel qr-launcher"><div><QrCode /><span><strong>Check-in con QR</strong><small>Muéstralo en pantalla o descárgalo para imprimir.</small></span></div><button className="button primary" onClick={() => setOpen(true)} type="button"><QrCode />Mostrar QR</button></div>{open ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div aria-modal="true" className="panel qr-panel qr-dialog" ref={panel} role="dialog"><div className="section-heading"><div><h2>QR del servicio</h2><p className="muted">Escanéalo desde un dispositivo personal para registrar asistencia.</p></div><button aria-label="Cerrar QR" className="icon-button" onClick={() => setOpen(false)} type="button"><X /></button></div><div className="qr-image-frame"><img alt="Código QR para registrar asistencia" className="qr-image" height="340" src={source} width="340" /></div><div className="manual-code-callout"><span>¿No puedes escanearlo?</span><strong>{manualCode}</strong><small>Visita {manualUrl.replace(/^https?:\/\//, "")}</small></div><details className="qr-technical-url"><summary>Mostrar dirección completa</summary><code className="qr-url">{publicUrl}</code></details><div className="actions qr-actions"><button className="button" onClick={() => panel.current?.requestFullscreen()} type="button"><Expand />Pantalla completa</button><button className="button" onClick={() => window.print()} type="button"><Printer />Imprimir</button><a className="button" download={`asistencia-${sessionId}.png`} href={source}><Download />Descargar PNG</a><details className="overflow-actions"><summary className="button"><MoreHorizontal />Más</summary><ActionForm action={regenerateAttendanceQrAction} confirmMessage="¿Regenerar el QR y el código manual? Los códigos anteriores dejarán de funcionar inmediatamente." successMessage="Los códigos se regeneraron correctamente."><input name="sessionId" type="hidden" value={sessionId} /><button className="button danger" type="submit">Regenerar códigos</button></ActionForm></details></div></div></div> : null}</>;
}
