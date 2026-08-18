"use client";

import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAppState } from "@/components/AppStateProvider";
import type { ContentLibraryItem, ExportJob, ExportTag, MediaAssetRole, ServiceItem, ServiceItemType, ServicePlan } from "@/lib/domain";
import { cancelExportJob, createExportJob, createProPresenterExport, deleteExportJob, getExportJobs } from "@/lib/export-actions";
import { deleteMediaAsset } from "@/lib/media-actions";
import {
  addServiceItem, createBlankService, deleteServiceItem, deleteServicePlan, duplicateServiceItem,
  duplicateServicePlan, getServicePlanAction, reorderServiceItems, saveServicePlanDetails, updateServiceItem
} from "@/lib/service-actions";
import { orderedItems } from "@/lib/service-plan";
import { paginateServiceItem } from "@/lib/slide-pagination";
import { resolveSlideTheme, slideResolutionPresets, slideThemeBackgroundStyle } from "@/lib/slide-themes";
import { addLibraryItemToService, listContentLibrary, saveServiceItemToLibrary } from "@/lib/content-library-actions";
import * as tus from "tus-js-client";
import { serviceItemTypeLabels } from "@/lib/ui-labels";

const serviceTypes: Array<{ value: ServiceItemType; label: string }> = [
  { value: "SONG", label: "Canción" }, { value: "SCRIPTURE", label: "Escritura" },
  { value: "ANNOUNCEMENT", label: "Anuncio" }, { value: "SERMON_NOTE", label: "Nota de sermón" },
  { value: "PRAYER", label: "Oración" }, { value: "MEDIA_CUE", label: "Indicación multimedia" },
  { value: "CUSTOM_TEXT", label: "Texto personalizado" }
];
const exportTags: Array<{ value: ExportTag; label: string }> = [
  { value: "SLIDE", label: "diapositiva / ProPresenter" }, { value: "PDF", label: "PDF de textos" },
  { value: "INTERNAL", label: "guion interno" }
];
const mediaRoles: MediaAssetRole[] = ["PRIMARY", "BACKGROUND", "AUDIO", "REFERENCE"];

function toDateInputValue(value: string) { return new Date(value).toISOString().slice(0, 10); }
function serviceDateFromInput(value: string) { return `${value}T10:00:00.000Z`; }
function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
function formatBytes(value?: number) {
  if (value == null) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Monterrey"
  }).format(new Date(value));
}

export function ServicesClient({ initialExportJobs, initialLibraryItems, servicePlanId, section = "all", embedded = false }: { initialExportJobs: ExportJob[]; initialLibraryItems: ContentLibraryItem[]; servicePlanId?: string; section?: "all" | "content" | "exports"; embedded?: boolean }) {
  const { servicePlans, activeServicePlan: stateActiveServicePlan, activeServicePlanId, setActiveServicePlanId, updateServicePlan, addServicePlan, removeServicePlan, theme, slideThemes } = useAppState();
  const activeServicePlan = servicePlanId ? servicePlans.find((plan) => plan.id === servicePlanId) ?? stateActiveServicePlan : stateActiveServicePlan;
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const [selectedCopyIds, setSelectedCopyIds] = useState<string[]>(activeServicePlan.items.map((item) => item.id));
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [jobs, setJobs] = useState(initialExportJobs);
  const [exportDialog, setExportDialog] = useState<"package" | "slides" | null>(null);
  const [exportWidth, setExportWidth] = useState(theme.defaultSlideWidth);
  const [exportHeight, setExportHeight] = useState(theme.defaultSlideHeight);
  const [libraryItems, setLibraryItems] = useState(initialLibraryItems);
  const [selectedLibraryId, setSelectedLibraryId] = useState(initialLibraryItems[0]?.id ?? "");

  useEffect(() => {
    if (!jobs.some((job) => job.status === "PENDING" || job.status === "PROCESSING")) return;
    const timer = window.setInterval(() => { void getExportJobs().then(setJobs); }, 3000);
    return () => window.clearInterval(timer);
  }, [jobs]);

  useEffect(() => {
    if (servicePlanId && servicePlanId !== activeServicePlanId) setActiveServicePlanId(servicePlanId);
  }, [activeServicePlanId, servicePlanId, setActiveServicePlanId]);

  const sortedPlans = useMemo(() => [...servicePlans].sort((a, b) => new Date(b.serviceAt).getTime() - new Date(a.serviceAt).getTime()), [servicePlans]);
  const currentItems = orderedItems(activeServicePlan);
  const duration = currentItems.reduce((total, item) => total + (item.durationMinutes ?? 0), 0);

  function selectPlan(plan: ServicePlan) {
    setActiveServicePlanId(plan.id);
    setSelectedCopyIds(plan.items.map((item) => item.id));
    setEditingItem(null);
    setMessage(`Servicio seleccionado: ${plan.title}.`);
  }

  async function run(label: string, task: () => Promise<void>) {
    setIsSaving(true); setMessage(label);
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar la operación."); }
    finally { setIsSaving(false); }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run("Guardando detalles del servicio...", async () => {
      const plan = await saveServicePlanDetails({
        servicePlanId: activeServicePlan.id,
        title: String(data.get("plan-title") ?? ""), topic: String(data.get("plan-topic") ?? ""),
        serviceAt: serviceDateFromInput(String(data.get("plan-date"))),
        slideThemeId: String(data.get("plan-slide-theme") ?? "") || undefined
      });
      updateServicePlan(plan); setMessage("Detalles del servicio guardados.");
    });
  }

  async function createNextWeek() {
    await run("Creando el servicio de la próxima semana...", async () => {
      const plan = await duplicateServicePlan({ servicePlanId: activeServicePlan.id, itemIds: selectedCopyIds });
      addServicePlan(plan); setSelectedCopyIds(plan.items.map((item) => item.id)); setMessage("Se creó el servicio de la próxima semana.");
    });
  }

  async function createBlank() {
    await run("Creando servicio vacío...", async () => {
      const plan = await createBlankService({ fromServiceAt: activeServicePlan.serviceAt });
      addServicePlan(plan); setSelectedCopyIds([]); setMessage("Se creó el servicio vacío.");
    });
  }

  async function removePlan() {
    if (!window.confirm(`¿Eliminar “${activeServicePlan.title}” y todos sus elementos?`)) return;
    await run("Eliminando servicio...", async () => {
      await deleteServicePlan({ servicePlanId: activeServicePlan.id });
      removeServicePlan(activeServicePlan.id); setMessage("Servicio eliminado.");
    });
  }

  async function persistOrder(ids: string[]) {
    const optimistic = { ...activeServicePlan, items: ids.map((id, index) => ({ ...currentItems.find((item) => item.id === id)!, sortOrder: index + 1 })) };
    updateServicePlan(optimistic);
    await run("Guardando orden de elementos...", async () => {
      updateServicePlan(await reorderServiceItems({ servicePlanId: activeServicePlan.id, itemIds: ids }));
      setMessage("Orden de elementos guardado.");
    });
  }

  function moveItem(itemId: string, offset: number) {
    const ids = currentItems.map((item) => item.id);
    const from = ids.indexOf(itemId); const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void persistOrder(ids);
  }

  function dropItem(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) return;
    const ids = currentItems.map((item) => item.id);
    const from = ids.indexOf(draggedItemId); const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]); setDraggedItemId(null); void persistOrder(ids);
  }

  async function duplicateItem(itemId: string) {
    await run("Duplicando elemento...", async () => { updateServicePlan(await duplicateServiceItem({ itemId })); setMessage("Elemento duplicado."); });
  }

  async function removeItem(item: ServiceItem) {
    if (!window.confirm(`¿Eliminar “${item.title}”? Los archivos adjuntos pasarán al almacenamiento de recuperación.`)) return;
    await run("Eliminando elemento...", async () => { updateServicePlan(await deleteServiceItem({ itemId: item.id })); setEditingItem(null); setMessage("Elemento eliminado."); });
  }

  async function refreshPlan() {
    const plan = await getServicePlanAction({ servicePlanId: activeServicePlan.id });
    updateServicePlan(plan);
    if (editingItem) setEditingItem(plan.items.find((item) => item.id === editingItem.id) ?? null);
  }

  async function exportProPresenter(servicePlanId = activeServicePlan.id, width = exportWidth, height = exportHeight) {
    await run("Queueing ProPresenter package...", async () => {
      const job = await createProPresenterExport({ servicePlanId, width, height });
      setJobs((current) => [job, ...current.filter((candidate) => candidate.id !== job.id)]);
      setMessage("Package queued. Progress appears in Exportaciones recientes.");
    });
  }

  async function cancelExport(jobId: string) {
    await cancelExportJob({ jobId });
    setJobs(await getExportJobs());
  }

  async function runConfiguredExport() {
    if (exportWidth < 640 || exportWidth > 3840 || exportHeight < 360 || exportHeight > 2160 || exportWidth * 9 !== exportHeight * 16) { setMessage("La resolución debe estar dentro de los límites y conservar una proporción 16:9."); return; }
    setExportDialog(null);
    if (exportDialog === "slides") {
      await queueStandaloneExport("SLIDE_IMAGES", exportWidth, exportHeight);
      return;
    }
    await exportProPresenter(activeServicePlan.id, exportWidth, exportHeight);
  }

  async function queueStandaloneExport(kind: "SLIDE_IMAGES" | "TEXT_PDF" | "RUN_SHEET_PDF", width?: number, height?: number) {
    await run("Queueing export...", async () => {
      const job = await createExportJob({ servicePlanId: activeServicePlan.id, kind, width, height });
      setJobs((current) => [job, ...current.filter((candidate) => candidate.id !== job.id)]);
      setMessage("Export queued. Download it from Exportaciones recientes when complete.");
    });
  }

  async function dismissExport(jobId: string) {
    await deleteExportJob({ jobId });
    setJobs((current) => current.filter((job) => job.id !== jobId));
  }

  async function addFromLibrary() {
    if (!selectedLibraryId) return;
    await run("Adding library content...", async () => { await addLibraryItemToService({ libraryItemId: selectedLibraryId, servicePlanId: activeServicePlan.id }); await refreshPlan(); setLibraryItems(await listContentLibrary()); setMessage("Library content added as a service snapshot."); });
  }

  async function storeInLibrary(itemId: string) {
    await saveServiceItemToLibrary({ itemId }); setLibraryItems(await listContentLibrary()); setMessage("Content saved to the reusable library.");
  }

  return (
    <>
      {!embedded ? <PageHeader title="Servicios" subtitle="Prepara el contenido y genera un paquete ordenado para ProPresenter."
        actions={<><button className="button primary" disabled={isSaving} onClick={createNextWeek}>Crear próxima semana</button><button className="button" disabled={isSaving} onClick={createBlank}>Servicio vacío</button></>} />
      : null}
      <section className="content grid service-workspace">
        {message ? <div className="notice">{message}</div> : null}
        {section === "all" ? <div className="grid two service-overview">
          <div className="panel">
            <div className="section-heading"><div><h2>Servicios semanales</h2><p className="muted">Selecciona la semana que deseas preparar.</p></div><span className="tag">{servicePlans.length} planificados</span></div>
            <div className="service-list">{sortedPlans.map((plan) => <button className={plan.id === activeServicePlanId ? "service-card selected" : "service-card"} key={plan.id} onClick={() => selectPlan(plan)}><strong>{plan.title}</strong><span>{formatDate(plan.serviceAt)} · {plan.items.length} elementos</span></button>)}</div>
          </div>
          <div className="panel">
            <h2>Duplicar para la próxima semana</h2><p className="muted">Selecciona el contenido que debe copiarse.</p>
            <div className="copy-list">{currentItems.map((item) => <label key={item.id}><input checked={selectedCopyIds.includes(item.id)} onChange={() => setSelectedCopyIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])} type="checkbox" />{item.title}</label>)}</div>
          </div>
        </div> : null}

        {section !== "exports" ? <><div className="panel">
          <div className="section-heading"><h2>Detalles del servicio</h2>{section === "all" ? <button className="button danger" disabled={servicePlans.length <= 1 || isSaving} onClick={removePlan}>Eliminar servicio</button> : null}</div>
          <form className="form-grid compact-form service-details-form" key={activeServicePlan.id} onSubmit={savePlan}>
            <div className="field"><label htmlFor="plan-title">Nombre</label><input id="plan-title" maxLength={120} minLength={2} name="plan-title" defaultValue={activeServicePlan.title} required /></div>
            <div className="field"><label htmlFor="plan-topic">Tema</label><input id="plan-topic" maxLength={500} name="plan-topic" defaultValue={activeServicePlan.topic ?? ""} /></div>
            <div className="field"><label htmlFor="plan-date">Fecha</label><input id="plan-date" name="plan-date" required type="date" defaultValue={toDateInputValue(activeServicePlan.serviceAt)} /></div>
            <div className="field"><label htmlFor="plan-slide-theme">Tema de diapositivas</label><select id="plan-slide-theme" name="plan-slide-theme" defaultValue={activeServicePlan.slideThemeId ?? ""}><option value="">Predeterminado de la iglesia</option>{slideThemes.map((slideTheme) => <option key={slideTheme.id} value={slideTheme.id}>{slideTheme.name}</option>)}</select></div>
            <button className="button primary" disabled={isSaving} type="submit">Guardar</button>
          </form>
        </div>

        <div className="panel library-toolbar"><div><h2>Biblioteca de contenido</h2><p className="muted">Reutiliza canciones, escrituras y anuncios sin modificar servicios anteriores.</p></div><select aria-label="Contenido de la biblioteca" value={selectedLibraryId} onChange={(event) => setSelectedLibraryId(event.target.value)}><option value="">Seleccionar contenido...</option>{libraryItems.map((libraryItem) => <option value={libraryItem.id} key={libraryItem.id}>{serviceItemTypeLabels[libraryItem.type]} · {libraryItem.title}</option>)}</select><button className="button primary" disabled={!selectedLibraryId || isSaving} onClick={addFromLibrary}>Agregar</button></div>

        <div className="grid planner-layout">
          <div className="panel">
            <div className="section-heading"><div><h2>{activeServicePlan.title}</h2><p className="muted">{formatDate(activeServicePlan.serviceAt)} · {duration} minutos estimados</p></div><span className="tag">{currentItems.length} elementos</span></div>
            {currentItems.length ? currentItems.map((item, index) => {
              const pagination = paginateServiceItem(item, theme);
              const itemSlideTheme = resolveSlideTheme(item, activeServicePlan, slideThemes);
              return <article className="service-item editable" draggable key={item.id} onDragStart={() => setDraggedItemId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropItem(event, item.id)}>
                <span className="order drag-handle" title="Arrastrar para reordenar">{index + 1}</span>
                <div><strong>{item.title}</strong><p className="muted">{serviceItemTypeLabels[item.type]} · {item.durationMinutes ?? 0} min · {pagination.slides.length} diapositivas · {itemSlideTheme?.name ?? "Predeterminado"}</p><p className="item-summary">{item.body.replace(/^\s*---\s*$/gm, " / ")}</p>{item.mediaAssets.length ? <div className="asset-list">{item.mediaAssets.map((asset) => <span className="tag" key={asset.id}>{asset.role.toLowerCase()}: {asset.originalName}</span>)}</div> : null}</div>
                <div className="item-tools"><button aria-label={`Subir ${item.title}`} disabled={index === 0 || isSaving} onClick={() => moveItem(item.id, -1)} title="Subir">↑</button><button aria-label={`Bajar ${item.title}`} disabled={index === currentItems.length - 1 || isSaving} onClick={() => moveItem(item.id, 1)} title="Bajar">↓</button><button onClick={() => setEditingItem(item)}>Editar</button><button onClick={() => duplicateItem(item.id)}>Duplicar</button><button onClick={() => storeInLibrary(item.id)}>Biblioteca</button><button className="danger-text" onClick={() => removeItem(item)}>Eliminar</button></div>
              </article>;
            }) : <p className="muted">Todavía no hay elementos.</p>}
          </div>
          <ItemEditor key={editingItem?.id ?? `new-${activeServicePlan.id}`} item={editingItem} isSaving={isSaving} onCancel={() => setEditingItem(null)} onRefresh={refreshPlan} onSaved={(plan) => { updateServicePlan(plan); setEditingItem(null); setMessage("Elemento del servicio guardado."); }} servicePlan={activeServicePlan} setMessage={setMessage} slideThemes={slideThemes} theme={theme} />
        </div>

        </> : null}

        {section !== "content" ? <div className="grid two">
          <div className="panel"><div className="section-heading"><div><h2>Paquete ProPresenter</h2><p className="muted">TXT, PNG con tema, PPTX, PDFs, manifiesto y multimedia adjunta.</p></div><button className="button primary" disabled={isSaving} onClick={() => setExportDialog("package")}>Generar paquete</button></div><div className="actions"><button className="button" onClick={() => setExportDialog("slides")}>ZIP de diapositivas</button><button className="button" onClick={() => queueStandaloneExport("TEXT_PDF")}>PDF de textos</button><button className="button" onClick={() => queueStandaloneExport("RUN_SHEET_PDF")}>Guion PDF</button><a className="button" href={`/attendance?servicePlanId=${activeServicePlan.id}`}>Abrir asistencia</a></div></div>
          <div className="panel"><h2>Exportaciones recientes</h2>{jobs.length ? <div className="export-list">{jobs.map((job) => <div key={job.id}><div><strong>{job.kind.replaceAll("_", " ")}</strong><span>{formatDateTime(job.createdAt)} · {formatBytes(job.sizeBytes)}{job.width && job.height ? ` · ${job.width}×${job.height}` : ""}</span>{job.status === "PROCESSING" || job.status === "PENDING" ? <progress max="100" value={job.progress}>{job.progress}%</progress> : null}{job.errorMessage ? <span>{job.errorMessage}</span> : null}</div><div className="actions">{job.status === "COMPLETE" ? <a className="button" href={`/api/exports/jobs/${job.id}`}>Descargar</a> : <span className="tag">{job.status}{job.status === "PROCESSING" ? ` ${job.progress}%` : ""}</span>}{job.status === "PENDING" || job.status === "PROCESSING" ? <button className="button danger" onClick={() => cancelExport(job.id)}>Cancelar</button> : null}{job.kind === "PROPRESENTER_PACKAGE" && job.servicePlanId && !["PENDING", "PROCESSING"].includes(job.status) ? <button className="button" disabled={isSaving} onClick={() => exportProPresenter(job.servicePlanId, job.width ?? theme.defaultSlideWidth, job.height ?? theme.defaultSlideHeight)}>Regenerar</button> : null}{job.status === "FAILED" || job.status === "CANCELLED" ? <button className="button danger" onClick={() => dismissExport(job.id)}>Descartar</button> : null}</div></div>)}</div> : <p className="muted">Todavía no hay archivos generados.</p>}</div>
        </div> : null}
      </section>
      {exportDialog ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportDialog(null); }}><section aria-modal="true" className="panel export-dialog" role="dialog"><div className="section-heading"><div><h2>{exportDialog === "package" ? "Generar paquete ProPresenter" : "Exportar imágenes"}</h2><p className="muted">Selecciona la resolución de los archivos PNG.</p></div><button aria-label="Cerrar configuración de exportación" className="icon-button" onClick={() => setExportDialog(null)}>×</button></div><div className="resolution-presets">{slideResolutionPresets.map((preset) => <button className={preset.width === exportWidth && preset.height === exportHeight ? "button primary" : "button"} key={preset.label} onClick={() => { setExportWidth(preset.width); setExportHeight(preset.height); }}>{preset.label}</button>)}</div><div className="grid two resolution-fields"><div className="field"><label htmlFor="export-width">Ancho</label><input id="export-width" min="640" max="3840" onChange={(event) => setExportWidth(Number(event.target.value))} type="number" value={exportWidth} /></div><div className="field"><label htmlFor="export-height">Alto</label><input id="export-height" min="360" max="2160" onChange={(event) => setExportHeight(Number(event.target.value))} type="number" value={exportHeight} /></div></div><p className={exportWidth * 9 === exportHeight * 16 ? "muted" : "warning"}>{exportWidth}×{exportHeight} · {exportWidth * 9 === exportHeight * 16 ? "16:9" : "Las dimensiones deben ser 16:9"}</p><div className="actions"><button className="button primary" disabled={isSaving || exportWidth * 9 !== exportHeight * 16} onClick={runConfiguredExport}>Exportar</button><button className="button" onClick={() => setExportDialog(null)}>Cancelar</button></div></section></div> : null}
    </>
  );
}

function ItemEditor({ item, servicePlan, slideThemes, theme, isSaving, onSaved, onCancel, onRefresh, setMessage }: {
  item: ServiceItem | null; servicePlan: ServicePlan; slideThemes: ReturnType<typeof useAppState>["slideThemes"]; theme: ReturnType<typeof useAppState>["theme"]; isSaving: boolean;
  onSaved: (plan: ServicePlan) => void; onCancel: () => void; onRefresh: () => Promise<void>; setMessage: (value: string) => void;
}) {
  const servicePlanId = servicePlan.id;
  const key = item?.id ?? `new-${servicePlanId}`;
  const [type, setType] = useState<ServiceItemType>(item?.type ?? "SONG");
  const [title, setTitle] = useState(item?.title ?? ""); const [body, setBody] = useState(item?.body ?? "");
  const [notes, setNotes] = useState(item?.notes ?? ""); const [duration, setDuration] = useState(String(item?.durationMinutes ?? 5));
  const [tags, setTags] = useState<ExportTag[]>(item?.exportTags ?? ["SLIDE", "PDF"]);
  const [mediaRole, setMediaRole] = useState<MediaAssetRole>("PRIMARY");
  const [slideThemeId, setSlideThemeId] = useState(item?.slideThemeId ?? "");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const previewItem = { id: item?.id ?? "preview", servicePlanId, type, title: title || "Preview", body, notes, durationMinutes: Number(duration), sortOrder: item?.sortOrder ?? 0, exportTags: tags, mediaAssets: item?.mediaAssets ?? [], slideThemeId: slideThemeId || undefined };
  const pagination = paginateServiceItem(previewItem, theme);
  const previewTheme = resolveSlideTheme(previewItem, servicePlan, slideThemes);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = { type, title, body, notes, durationMinutes: duration ? Number(duration) : undefined, exportTags: tags, slideThemeId: slideThemeId || undefined };
      onSaved(item ? await updateServiceItem({ itemId: item.id, ...payload }) : await addServiceItem({ servicePlanId, ...payload }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el elemento."); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const form = event.currentTarget; const file = new FormData(form).get("file"); if (!(file instanceof File)) return;
    setMessage("Subiendo archivo multimedia..."); setUploadProgress(0);
    try {
      await new Promise<void>((resolve, reject) => { const upload = new tus.Upload(file, { endpoint: "/api/uploads", chunkSize: 8 * 1024 * 1024, retryDelays: [0, 1000, 3000, 5000], metadata: { filename: file.name, filetype: file.type, serviceItemId: item.id, role: mediaRole }, onProgress: (sent, total) => setUploadProgress(Math.round((sent / total) * 100)), onError: reject, onSuccess: () => resolve() }); void upload.findPreviousUploads().then((previous) => { if (previous[0]) upload.resumeFromPreviousUpload(previous[0]); upload.start(); }); });
      await onRefresh(); setMessage("Archivo multimedia cargado."); form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo subir el archivo."); }
    finally { setUploadProgress(null); }
  }

  return <aside className="panel item-editor" key={key}><div className="section-heading"><h2>{item ? "Editar elemento" : "Agregar elemento"}</h2>{item ? <button className="button" onClick={onCancel}>Nuevo elemento</button> : null}</div>
    <form className="form-grid" onSubmit={submit}>
      <div className="field"><label htmlFor="item-type">Tipo</label><select id="item-type" onChange={(event) => setType(event.target.value as ServiceItemType)} value={type}>{serviceTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div className="field"><label htmlFor="item-title">Título</label><input id="item-title" maxLength={160} onChange={(event) => setTitle(event.target.value)} value={title} required /></div>
      <div className="field"><label htmlFor="item-body">Contenido</label><textarea id="item-body" maxLength={100000} onChange={(event) => setBody(event.target.value)} placeholder="Usa --- en una línea separada para crear un corte manual" value={body} required /></div>
      <div className="field"><label htmlFor="item-notes">Notas internas</label><textarea id="item-notes" maxLength={10000} onChange={(event) => setNotes(event.target.value)} value={notes} /></div>
      <div className="field"><label htmlFor="item-duration">Duración en minutos</label><input id="item-duration" max="1440" min="0" onChange={(event) => setDuration(event.target.value)} step="1" type="number" value={duration} /></div>
      <div className="field"><label htmlFor="item-slide-theme">Tema de diapositivas</label><select id="item-slide-theme" onChange={(event) => setSlideThemeId(event.target.value)} value={slideThemeId}><option value="">Usar tema del servicio</option>{slideThemes.map((slideTheme) => <option key={slideTheme.id} value={slideTheme.id}>{slideTheme.name}</option>)}</select></div>
      <fieldset className="checkbox-group"><legend>Etiquetas de exportación</legend>{exportTags.map((tag) => <label key={tag.value}><input checked={tags.includes(tag.value)} onChange={() => setTags((current) => current.includes(tag.value) ? current.filter((value) => value !== tag.value) : [...current, tag.value])} type="checkbox" />{tag.label}</label>)}</fieldset>
      <button className="button primary" disabled={isSaving} type="submit">{item ? "Guardar elemento" : "Agregar elemento"}</button>
    </form>
    <div className="slide-pages"><h3>Vista previa · {previewTheme?.name ?? "Predeterminado de la iglesia"}</h3>{pagination.slides.map((lines, index) => <div className={`mini-slide ${previewTheme?.layout === "LOWER_THIRD" ? "lower" : ""}`} key={`${lines.join("-")}-${index}`} style={previewTheme ? slideThemeBackgroundStyle(previewTheme) : undefined}><i style={previewTheme ? { background: previewTheme.overlayColor, opacity: previewTheme.overlayOpacity / 100 } : undefined} /><span>{index + 1}</span><strong>{type === "SONG" ? "" : title}</strong><p>{lines.join("\n")}</p></div>)}{pagination.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}</div>
    {item ? <><form className="form-grid media-upload" onSubmit={upload}><h3>Adjuntar multimedia</h3><div className="field"><label htmlFor="media-role">Uso</label><select id="media-role" onChange={(event) => setMediaRole(event.target.value as MediaAssetRole)} value={mediaRole}>{mediaRoles.map((role) => <option key={role}>{role}</option>)}</select></div><div className="field"><label htmlFor="media-file">Archivo</label><input accept="audio/*,video/*,image/*" id="media-file" name="file" required type="file" /></div>{uploadProgress != null ? <progress max="100" value={uploadProgress}>{uploadProgress}%</progress> : null}<button className="button" type="submit">Subir archivo</button></form><div className="asset-management">{item.mediaAssets.map((asset) => <div key={asset.id}><a href={`/api/media/${asset.id}`}>{asset.originalName}</a><button className="danger-text" onClick={async () => { if (window.confirm(`¿Retirar ${asset.originalName}?`)) { await deleteMediaAsset({ assetId: asset.id }); await onRefresh(); } }} type="button">Retirar</button></div>)}</div></> : <p className="muted editor-hint">Guarda el elemento antes de adjuntar archivos.</p>}
  </aside>;
}
