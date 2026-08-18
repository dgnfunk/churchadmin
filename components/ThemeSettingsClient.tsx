"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAppState } from "@/components/AppStateProvider";
import type { SlideTheme, ThemeMode } from "@/lib/domain";
import {
  deleteSlideTheme, duplicateSlideTheme, listSlideThemes, saveSlideTheme, saveThemeSettings
} from "@/lib/theme-actions";
import { slideResolutionPresets, slideThemeBackgroundStyle } from "@/lib/slide-themes";

function normalizeHexColor(value: string, fallback: string) {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function safeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}

function newSlideTheme(churchId: string, primaryColor: string, accentColor: string): SlideTheme {
  return {
    id: "", churchId, name: "Nuevo tema de diapositivas", isDefault: false, backgroundType: "COLOR",
    backgroundColor: primaryColor, overlayColor: "#102421", overlayOpacity: 36,
    textColor: "#ffffff", accentColor, layout: "CENTERED", fontFamily: "INTER", titleFontSize: 82,
    bodyFontSize: 46, fontWeight: 700, safeMargin: 96, logoPlacement: "TOP_LEFT"
  };
}

export function ThemeSettingsClient() {
  const state = useAppState();
  const { church, theme, slideThemes, updateChurch, updateTheme, replaceSlideThemes } = state;
  const [message, setMessage] = useState("");
  const [churchName, setChurchName] = useState(church.name);
  const [logoUrl, setLogoUrl] = useState(church.logoUrl ?? theme.logoUrl ?? "");
  const [timeZone, setTimeZone] = useState(church.timeZone);
  const [defaultPhoneRegion, setDefaultPhoneRegion] = useState(church.defaultPhoneRegion);
  const [primaryColor, setPrincipalColor] = useState(theme.primaryColor);
  const [accentColor, setSecundarioColor] = useState(theme.accentColor);
  const [mode, setMode] = useState<ThemeMode>(theme.mode);
  const [songLinesPerSlide, setSongLinesPerSlide] = useState(theme.songLinesPerSlide);
  const [textLinesPerSlide, setTextLinesPerSlide] = useState(theme.textLinesPerSlide);
  const [maxCharactersPerSlide, setMaxCharactersPerSlide] = useState(theme.maxCharactersPerSlide);
  const [defaultWidth, setDefaultWidth] = useState(theme.defaultSlideWidth);
  const [defaultHeight, setDefaultHeight] = useState(theme.defaultSlideHeight);
  const [selectedTheme, setSelectedTheme] = useState<SlideTheme>(slideThemes[0] ?? newSlideTheme(church.id, primaryColor, accentColor));

  async function refreshThemes(selectId?: string) {
    const next = await listSlideThemes();
    replaceSlideThemes(next);
    setSelectedTheme(next.find((candidate) => candidate.id === selectId) ?? next[0] ?? newSlideTheme(church.id, primaryColor, accentColor));
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanLogoUrl = safeHttpUrl(logoUrl);
    if (churchName.trim().length < 2) { setMessage("Escribe un nombre válido para la iglesia."); return; }
    if (logoUrl.trim() && !cleanLogoUrl) { setMessage("La dirección del logotipo debe comenzar con http:// o https://."); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor) || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) { setMessage("Los colores deben usar un código hexadecimal válido."); return; }
    if (defaultWidth * 9 !== defaultHeight * 16) { setMessage("La resolución debe conservar una proporción 16:9."); return; }
    const cleanPrincipal = normalizeHexColor(primaryColor, theme.primaryColor);
    const cleanSecundario = normalizeHexColor(accentColor, theme.accentColor);
    setMessage("Guardando configuración...");
    try {
      await saveThemeSettings({
        churchId: church.id, churchName, logoUrl: cleanLogoUrl, primaryColor: cleanPrincipal,
        accentColor: cleanSecundario, mode, songLinesPerSlide, textLinesPerSlide,
        maxCharactersPerSlide, defaultSlideWidth: defaultWidth, defaultSlideHeight: defaultHeight, timeZone, defaultPhoneRegion
      });
      updateChurch({ ...church, name: churchName.trim() || "Nombre de la iglesia", logoUrl: cleanLogoUrl, timeZone, defaultPhoneRegion });
      updateTheme({
        ...theme, primaryColor: cleanPrincipal, accentColor: cleanSecundario, mode, logoUrl: cleanLogoUrl,
        songLinesPerSlide, textLinesPerSlide, maxCharactersPerSlide,
        defaultSlideWidth: defaultWidth, defaultSlideHeight: defaultHeight
      });
      setPrincipalColor(cleanPrincipal); setSecundarioColor(cleanSecundario); setLogoUrl(cleanLogoUrl ?? "");
      setMessage("Marca y valores de exportación guardados.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración."); }
  }

  async function persistSlideTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTheme.name.trim().length < 2) { setMessage("Escribe un nombre válido para el tema."); return; }
    setMessage("Guardando tema de diapositivas...");
    try {
      const saved = await saveSlideTheme({
        id: selectedTheme.id || undefined, name: selectedTheme.name, isDefault: selectedTheme.isDefault,
        backgroundType: selectedTheme.backgroundType, backgroundColor: selectedTheme.backgroundColor,
        overlayColor: selectedTheme.overlayColor, overlayOpacity: selectedTheme.overlayOpacity,
        textColor: selectedTheme.textColor, accentColor: selectedTheme.accentColor, layout: selectedTheme.layout,
        fontFamily: selectedTheme.fontFamily, titleFontSize: selectedTheme.titleFontSize, bodyFontSize: selectedTheme.bodyFontSize,
        fontWeight: selectedTheme.fontWeight, safeMargin: selectedTheme.safeMargin, logoPlacement: selectedTheme.logoPlacement
      });
      await refreshThemes(saved.id);
      setMessage("Tema de diapositivas guardado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el tema de diapositivas."); }
  }

  async function uploadBackground(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTheme.id) { setMessage("Guarda el tema antes de subir una imagen de fondo."); return; }
    const form = event.currentTarget;
    const data = new FormData(form); data.set("slideThemeId", selectedTheme.id);
    setMessage("Subiendo imagen de fondo...");
    const response = await fetch("/api/media/upload?purpose=theme", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "No se pudo subir la imagen de fondo."); return; }
    await refreshThemes(selectedTheme.id); form.reset(); setMessage("Imagen de fondo aplicada.");
  }

  async function uploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setMessage("Subiendo logotipo...");
    const response = await fetch("/api/media/upload?purpose=logo", { method: "POST", body: new FormData(form) }); const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "No se pudo subir el logotipo."); return; }
    updateChurch({ ...church, logoAssetId: result.id }); form.reset(); setMessage("Logotipo cargado.");
  }

  const selectedPreset = slideResolutionPresets.find((preset) => preset.width === defaultWidth && preset.height === defaultHeight)?.label ?? "custom";
  const previewStyle = slideThemeBackgroundStyle(selectedTheme);

  return <>
    <PageHeader title="Apariencia" subtitle="Administra la marca, los temas de diapositivas y los valores de exportación." actions={<nav aria-label="Secciones de apariencia" className="segmented"><a href="#marca">Marca</a><a href="#temas">Temas de diapositivas</a><a href="#exportacion">Exportación</a></nav>} />
    <section className="content grid theme-workspace">
      {message ? <div className="notice">{message}</div> : null}
      <div className="grid two">
        <div className="panel" id="marca">
          <h2>Marca de la iglesia</h2>
          <form className="form-grid" onSubmit={saveBrand}>
            <div className="field"><label htmlFor="church-name">Nombre de la iglesia</label><input id="church-name" maxLength={120} minLength={2} onChange={(event) => setChurchName(event.target.value)} required value={churchName} /></div>
            <div className="field"><label htmlFor="logo">Dirección del logotipo</label><input id="logo" maxLength={2048} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://..." type="url" value={logoUrl} /></div>
            <div className="field"><label htmlFor="timezone">Zona horaria</label><input id="timezone" list="timezones" maxLength={64} onChange={(event) => setTimeZone(event.target.value)} required value={timeZone} /><datalist id="timezones"><option value="America/Monterrey" /><option value="America/Mexico_City" /><option value="America/Chicago" /><option value="America/New_York" /><option value="America/Los_Angeles" /></datalist></div>
            <div className="field"><label htmlFor="phone-region">Región telefónica predeterminada</label><select id="phone-region" onChange={(event) => setDefaultPhoneRegion(event.target.value)} value={defaultPhoneRegion}><option value="MX">México (+52)</option><option value="US">Estados Unidos (+1)</option><option value="CA">Canada (+1)</option><option value="GT">Guatemala (+502)</option><option value="CO">Colombia (+57)</option></select></div>
            <ColorField id="primary" label="Principal" value={primaryColor} onChange={setPrincipalColor} />
            <ColorField id="accent" label="Secundario" value={accentColor} onChange={setSecundarioColor} />
            <div className="field"><label htmlFor="mode">Modo</label><select id="mode" onChange={(event) => setMode(event.target.value as ThemeMode)} value={mode}><option value="light">Claro</option><option value="dark">Oscuro</option></select></div>
            <div className="grid three" id="exportacion">
              <div className="field"><label htmlFor="song-lines">Líneas de canciones</label><input id="song-lines" max="8" min="1" onChange={(event) => setSongLinesPerSlide(Number(event.target.value))} type="number" value={songLinesPerSlide} /></div>
              <div className="field"><label htmlFor="text-lines">Líneas de texto</label><input id="text-lines" max="10" min="1" onChange={(event) => setTextLinesPerSlide(Number(event.target.value))} type="number" value={textLinesPerSlide} /></div>
              <div className="field"><label htmlFor="max-characters">Máximo de caracteres</label><input id="max-characters" max="500" min="40" onChange={(event) => setMaxCharactersPerSlide(Number(event.target.value))} type="number" value={maxCharactersPerSlide} /></div>
            </div>
            <fieldset className="checkbox-group"><legend>Resolución predeterminada</legend><div className="resolution-presets">{slideResolutionPresets.map((preset) => <button className={selectedPreset === preset.label ? "button primary" : "button"} key={preset.label} onClick={() => { setDefaultWidth(preset.width); setDefaultHeight(preset.height); }} type="button">{preset.label}</button>)}<button className={selectedPreset === "custom" ? "button primary" : "button"} type="button">Custom</button></div><div className="grid two resolution-fields"><div className="field"><label htmlFor="default-width">Ancho</label><input id="default-width" min="640" max="3840" onChange={(event) => setDefaultWidth(Number(event.target.value))} type="number" value={defaultWidth} /></div><div className="field"><label htmlFor="default-height">Alto</label><input id="default-height" min="360" max="2160" onChange={(event) => setDefaultHeight(Number(event.target.value))} type="number" value={defaultHeight} /></div></div></fieldset>
            <button className="button primary">Guardar configuración</button>
          </form>
          <form className="form-grid media-upload" onSubmit={uploadLogo}><h3>Logotipo cargado</h3><input accept="image/png,image/jpeg,image/webp" aria-label="Archivo de logotipo" name="file" required type="file" /><button className="button" type="submit">Subir logotipo</button></form>
        </div>
        <div className="panel">
          <h2>Vista previa de la aplicación</h2>
          <div className="swatches"><div className="swatch" style={{ background: primaryColor }} /><div className="swatch" style={{ background: accentColor }} /></div>
          <p><strong>{churchName || "Nombre de la iglesia"}</strong></p><p className="muted">Exportación predeterminada: {defaultWidth}×{defaultHeight}</p>
          <div className="actions"><button className="button primary" type="button">Acción principal</button><button className="button accent" type="button">Acción secundaria</button></div>
        </div>
      </div>

      <div className="panel" id="temas">
        <div className="section-heading"><div><h2>Temas de diapositivas</h2><p className="muted">Define un tema para el servicio y excepciones para elementos individuales.</p></div><button className="button primary" onClick={() => setSelectedTheme(newSlideTheme(church.id, primaryColor, accentColor))}>Nuevo tema</button></div>
        <div className="theme-library">
          <div className="theme-list">{slideThemes.map((slideTheme) => <button className={selectedTheme.id === slideTheme.id ? "theme-card selected" : "theme-card"} key={slideTheme.id} onClick={() => setSelectedTheme(slideTheme)}><span className="theme-card-preview" style={slideThemeBackgroundStyle(slideTheme)}>{slideTheme.name.slice(0, 1)}</span><span><strong>{slideTheme.name}</strong><small>{slideTheme.isDefault ? "Predeterminado · " : ""}{slideTheme.backgroundType.toLowerCase()}</small></span></button>)}</div>
          <div className="theme-editor">
            <div className="theme-preview" style={previewStyle}><div style={{ background: selectedTheme.overlayColor, opacity: selectedTheme.overlayOpacity / 100 }} /><span>{churchName || "Nombre de la iglesia"}</span><section className={selectedTheme.layout === "LOWER_THIRD" ? "lower" : "centered"}><h3>Lectura bíblica</h3><p style={{ color: selectedTheme.accentColor }}>Psalm 84:1-2</p></section></div>
            {selectedTheme.backgroundType === "IMAGE" && !selectedTheme.backgroundAssetId ? <p className="warning">No hay una imagen adjunta. Se usará el color de respaldo.</p> : null}
            <form className="form-grid" onSubmit={persistSlideTheme}>
              <div className="field"><label htmlFor="slide-theme-name">Nombre del tema</label><input id="slide-theme-name" maxLength={100} minLength={2} onChange={(event) => setSelectedTheme({ ...selectedTheme, name: event.target.value })} required value={selectedTheme.name} /></div>
              <div className="grid two"><div className="field"><label htmlFor="background-type">Fondo</label><select id="background-type" onChange={(event) => setSelectedTheme({ ...selectedTheme, backgroundType: event.target.value as SlideTheme["backgroundType"] })} value={selectedTheme.backgroundType}><option value="COLOR">Color</option><option value="IMAGE">Imagen</option></select></div><div className="field"><label htmlFor="slide-layout">Distribución</label><select id="slide-layout" onChange={(event) => setSelectedTheme({ ...selectedTheme, layout: event.target.value as SlideTheme["layout"] })} value={selectedTheme.layout}><option value="CENTERED">Centrado</option><option value="LOWER_THIRD">Tercio inferior</option></select></div></div>
              <ColorField id="slide-background" label="Color de respaldo" value={selectedTheme.backgroundColor} onChange={(value) => setSelectedTheme({ ...selectedTheme, backgroundColor: value })} />
              <ColorField id="slide-overlay" label="Overlay" value={selectedTheme.overlayColor} onChange={(value) => setSelectedTheme({ ...selectedTheme, overlayColor: value })} />
              <div className="field"><label htmlFor="overlay-opacity">Opacidad de capa: {selectedTheme.overlayOpacity}%</label><input id="overlay-opacity" min="0" max="90" onChange={(event) => setSelectedTheme({ ...selectedTheme, overlayOpacity: Number(event.target.value) })} type="range" value={selectedTheme.overlayOpacity} /></div>
              <ColorField id="slide-text" label="Texto" value={selectedTheme.textColor} onChange={(value) => setSelectedTheme({ ...selectedTheme, textColor: value })} />
              <ColorField id="slide-accent" label="Secundario" value={selectedTheme.accentColor} onChange={(value) => setSelectedTheme({ ...selectedTheme, accentColor: value })} />
              <div className="grid three"><div className="field"><label>Tipografía<select value={selectedTheme.fontFamily} onChange={(event) => setSelectedTheme({ ...selectedTheme, fontFamily: event.target.value as SlideTheme["fontFamily"] })}><option value="INTER">Inter</option><option value="ARIAL">Arial</option><option value="GEORGIA">Georgia</option></select></label></div><div className="field"><label>Tamaño de título<input type="number" min="36" max="140" value={selectedTheme.titleFontSize} onChange={(event) => setSelectedTheme({ ...selectedTheme, titleFontSize: Number(event.target.value) })} /></label></div><div className="field"><label>Tamaño de texto<input type="number" min="24" max="90" value={selectedTheme.bodyFontSize} onChange={(event) => setSelectedTheme({ ...selectedTheme, bodyFontSize: Number(event.target.value) })} /></label></div></div>
              <div className="grid three"><div className="field"><label>Peso<select value={selectedTheme.fontWeight} onChange={(event) => setSelectedTheme({ ...selectedTheme, fontWeight: Number(event.target.value) })}><option value="400">Normal</option><option value="600">Semibold</option><option value="700">Negrita</option><option value="900">Black</option></select></label></div><div className="field"><label>Margen seguro<input type="number" min="40" max="200" value={selectedTheme.safeMargin} onChange={(event) => setSelectedTheme({ ...selectedTheme, safeMargin: Number(event.target.value) })} /></label></div><div className="field"><label>Posición del logotipo<select value={selectedTheme.logoPlacement} onChange={(event) => setSelectedTheme({ ...selectedTheme, logoPlacement: event.target.value as SlideTheme["logoPlacement"] })}><option value="NONE">Sin logotipo</option><option value="TOP_LEFT">Superior izquierda</option><option value="TOP_RIGHT">Superior derecha</option><option value="BOTTOM_LEFT">Inferior izquierda</option><option value="BOTTOM_RIGHT">Inferior derecha</option></select></label></div></div>
              <label className="toggle-row"><input checked={selectedTheme.isDefault} disabled={selectedTheme.isDefault} onChange={(event) => setSelectedTheme({ ...selectedTheme, isDefault: event.target.checked })} type="checkbox" />Predeterminado de la iglesia</label>
              <div className="actions"><button className="button primary">Guardar tema</button>{selectedTheme.id ? <button className="button" onClick={async () => { const copy = await duplicateSlideTheme({ themeId: selectedTheme.id }); await refreshThemes(copy.id); setMessage("Theme duplicated."); }} type="button">Duplicar</button> : null}{selectedTheme.id && !selectedTheme.isDefault ? <button className="button danger" onClick={async () => { if (!window.confirm(`Delete ${selectedTheme.name}? Any usage will move to the church default.`)) return; const fallback = slideThemes.find((candidate) => candidate.isDefault); await deleteSlideTheme({ themeId: selectedTheme.id, replacementThemeId: fallback?.id }); await refreshThemes(fallback?.id); setMessage("Theme deleted."); }} type="button">Eliminar</button> : null}</div>
            </form>
            {selectedTheme.id ? <form className="form-grid media-upload" onSubmit={uploadBackground}><h3>Imagen de fondo</h3>{selectedTheme.backgroundAsset ? <a href={`/api/media/${selectedTheme.backgroundAsset.id}`}>{selectedTheme.backgroundAsset.originalName}</a> : <p className="muted">PNG, JPEG, or WebP up to 25 MB.</p>}<div className="field"><label htmlFor="theme-background-file">Archivo de imagen</label><input accept="image/png,image/jpeg,image/webp" id="theme-background-file" name="file" required type="file" /></div><button className="button">Subir y aplicar</button></form> : null}
          </div>
        </div>
      </div>
    </section>
  </>;
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return <div className="color-row"><div className="field"><label htmlFor={id}>{label} color</label><input id={id} onChange={(event) => onChange(event.currentTarget.value)} onInput={(event) => onChange(event.currentTarget.value)} type="color" value={pickerValue} /></div><div className="field"><label htmlFor={`${id}-hex`}>{label} hex</label><input id={`${id}-hex`} onBlur={() => onChange(normalizeHexColor(value, pickerValue))} onChange={(event) => onChange(event.currentTarget.value)} value={value} /></div></div>;
}
