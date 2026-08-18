import type { ServiceItem, ThemeSettings } from "@/lib/domain";

export interface PaginatedSlides {
  slides: string[][];
  warnings: string[];
}

function wrapLine(line: string, limit: number, warnings: string[]) {
  const clean = line.trim();
  if (clean.length <= limit) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > limit) warnings.push(`The word "${word}" exceeds the recommended slide width.`);
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > limit) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function paginateServiceItem(item: ServiceItem, theme: ThemeSettings): PaginatedSlides {
  const warnings: string[] = [];
  const maxLines = item.type === "SONG" ? theme.songLinesPerSlide : theme.textLinesPerSlide;
  const maxCharacters = theme.maxCharactersPerSlide;
  const lineLimit = Math.max(30, Math.floor(maxCharacters / Math.max(1, maxLines)));
  const manualBlocks = item.body.split(/^\s*---\s*$/m);
  const slides: string[][] = [];

  for (const block of manualBlocks) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => wrapLine(line, lineLimit, warnings));
    if (!lines.length) continue;

    let current: string[] = [];
    for (const line of lines) {
      const candidateCharacters = [...current, line].join("\n").length;
      if (current.length && (current.length >= maxLines || candidateCharacters > maxCharacters)) {
        slides.push(current);
        current = [];
      }
      current.push(line);
    }
    if (current.length) slides.push(current);
  }

  if (!slides.length) slides.push([item.title]);
  return { slides, warnings: [...new Set(warnings)] };
}

export function propresenterText(item: ServiceItem, theme: ThemeSettings) {
  const { slides } = paginateServiceItem(item, theme);
  return slides
    .map((lines) => item.type === "SONG" ? lines.join("\n") : [item.title, ...lines].join("\n"))
    .join("\n//\n");
}
