import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { requireScope } from "@/lib/auth";
import { reuseMediaAsset } from "@/lib/media-actions";
import { prisma } from "@/lib/prisma";
import { containsText } from "@/lib/database-compat";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireScope("services");
  const { q = "" } = await searchParams;
  const [assets, items] = await Promise.all([
    prisma.mediaAsset.findMany({ where: { churchId: user.churchId, ...(q ? { originalName: containsText(q) } : {}) }, include: { serviceItem: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.serviceItem.findMany({ where: { servicePlan: { churchId: user.churchId } }, include: { servicePlan: { select: { title: true, serviceAt: true } } }, orderBy: { servicePlan: { serviceAt: "desc" } }, take: 100 }),
  ]);

  return <>
    <PageHeader title="Multimedia" subtitle="Busca, revisa y reutiliza archivos multimedia." />
    <section className="content grid">
      <form className="panel filter-bar"><input aria-label="Buscar archivos multimedia" maxLength={120} name="q" defaultValue={q} placeholder="Buscar archivos" /><button className="button" type="submit">Buscar</button></form>
      <div className="media-grid">{assets.map((asset) => <article className="panel media-card" key={asset.id}>
        <div><strong>{asset.originalName}</strong><p className="muted">{asset.mimeType} · {Math.round(Number(asset.sizeBytes) / 1024)} KB</p><p className="muted">{asset.serviceItem?.title ?? "Archivo reutilizable de tema o logotipo"}</p><code>{asset.checksum.slice(0, 12)}</code></div>
        <div className="actions">
          <a className="button" href={`/api/media/${asset.id}`}>Vista previa</a>
          {asset.serviceItemId ? <ActionForm action={reuseMediaAsset} successMessage="El archivo se adjuntó correctamente.">
            <input name="assetId" type="hidden" value={asset.id} />
            <select aria-label="Elemento de servicio de destino" name="serviceItemId" required><option value="">Reutilizar en... </option>{items.map((item) => <option value={item.id} key={item.id}>{item.servicePlan.title} · {item.title}</option>)}</select>
            <button className="button" type="submit">Adjuntar copia</button>
          </ActionForm> : null}
        </div>
      </article>)}</div>
    </section>
  </>;
}
