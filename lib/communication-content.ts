const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);

export function youtubeVideoId(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Ingresa una dirección válida de YouTube."); }
  if (!youtubeHosts.has(url.hostname.toLowerCase())) throw new Error("La dirección debe pertenecer a YouTube.");
  const id = url.hostname.includes("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v") ?? (url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : null);
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error("No se encontró un identificador válido de video.");
  return id;
}

export async function loadYoutubeMetadata(input: string) {
  const id = youtubeVideoId(input);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("Configura YOUTUBE_API_KEY antes de crear campañas.");
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(id)}&key=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("YouTube no pudo validar el video en este momento.");
  const payload = await response.json() as { items?: Array<{ snippet?: { title?: string; description?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> } }> };
  const snippet = payload.items?.[0]?.snippet;
  if (!snippet?.title) throw new Error("El video no existe o no es público.");
  const thumbnails = snippet.thumbnails ?? {};
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: snippet.title,
    description: snippet.description ?? "",
    channel: snippet.channelTitle ?? "",
    thumbnailUrl: thumbnails.maxres?.url ?? thumbnails.standard?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? "",
  };
}

export type TemplateContext = {
  person?: { firstName: string };
  church: { name: string };
  service?: { title: string; date: string };
  youtube: { title: string; channel: string; url: string };
};

export function renderCommunicationTemplate(template: string, context: TemplateContext) {
  const values: Record<string, string> = {
    "person.firstName": context.person?.firstName ?? "",
    "church.name": context.church.name,
    "service.title": context.service?.title ?? "",
    "service.date": context.service?.date ?? "",
    "youtube.title": context.youtube.title,
    "youtube.channel": context.youtube.channel,
    "youtube.url": context.youtube.url,
  };
  return template.replace(/{{\s*([a-zA-Z.]+)\s*}}/g, (_match, key: string) => {
    if (!(key in values)) throw new Error(`La variable {{${key}}} no está permitida.`);
    return values[key];
  }).trim();
}

export function communicationTemplateVariables(template: string) {
  return [...template.matchAll(/{{\s*([a-zA-Z.]+)\s*}}/g)].map((match) => match[1]);
}

export function metaTemplateBody(template: string) {
  let index = 0;
  return template.replace(/{{\s*[a-zA-Z.]+\s*}}/g, () => `{{${++index}}}`);
}

export function templateVariableValues(template: string, context: TemplateContext) {
  return communicationTemplateVariables(template).map((variable) => renderCommunicationTemplate(`{{${variable}}}`, context));
}
