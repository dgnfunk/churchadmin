"use client";

import { useState } from "react";
import Papa from "papaparse";
import { importPeopleRows } from "@/lib/people-attendance-actions";

export function PeopleImport() {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return <div className="panel form-grid"><h2>Importar CSV</h2><p className="muted">Columnas: firstName, lastName, email, phone, personType, status, familyNotes, tags.</p><input accept=".csv,text/csv" aria-label="Archivo CSV de personas" type="file" onChange={(event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setRows([]); setMessage("El archivo no puede exceder 5 MB."); return; }
    Papa.parse<Record<string, string>>(file, { header: true, skipEmptyLines: true, complete: (result) => {
      const fields = result.meta.fields ?? [];
      if (!fields.includes("firstName") || !fields.includes("lastName")) { setRows([]); setMessage("El archivo debe incluir las columnas firstName y lastName."); return; }
      if (result.errors.length) { setRows([]); setMessage(`El CSV contiene ${result.errors.length} errores de formato.`); return; }
      setRows(result.data.slice(0, 2000));
      setMessage(`${Math.min(result.data.length, 2000)} filas listas para revisar${result.data.length > 2000 ? "; solo se procesarán las primeras 2,000" : ""}.`);
    } });
  }} />{rows.length ? <div className="import-preview"><strong>Vista previa</strong>{rows.slice(0, 5).map((row, index) => <span key={index}>{row.firstName} {row.lastName} · {row.email || row.phone}</span>)}</div> : null}<button className="button" disabled={!rows.length || busy} onClick={() => {
    setBusy(true);
    void importPeopleRows(rows).then((result) => {
      setMessage(`${result.imported} importadas. ${result.errors.length} errores.${result.errors.length ? ` ${result.errors.slice(0, 3).join(" ")}` : ""}`);
      setRows([]);
    }).catch(() => setMessage("No se pudo importar el archivo.")).finally(() => setBusy(false));
  }} type="button">{busy ? "Importando…" : "Importar filas"}</button>{message ? <p aria-live="polite" className="muted">{message}</p> : null}</div>;
}
