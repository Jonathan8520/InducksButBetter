import i18n from "../i18n";

const locale = () => i18n.resolvedLanguage || i18n.language || "en";

/**
 * Dates Inducks : précision variable (« 1952 », « 1952-02 », « 1952-02-11 ») et parfois
 * approximatives. On affiche exactement la précision connue, jamais plus.
 */
export function formatDate(raw: unknown, style: "long" | "short" = "long"): string {
  if (typeof raw !== "string" || !raw) return "";
  const m = raw.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return raw;
  const [, y, mo, d] = m;
  const month = mo ? Number(mo) : 0;
  const day = d ? Number(d) : 0;
  if (!month || month > 12) return y;
  const date = new Date(Date.UTC(Number(y), month - 1, day && day <= 31 ? day : 1));
  const opts: Intl.DateTimeFormatOptions =
    day && day <= 31
      ? { year: "numeric", month: style === "long" ? "long" : "short", day: "numeric", timeZone: "UTC" }
      : { year: "numeric", month: style === "long" ? "long" : "short", timeZone: "UTC" };
  try {
    return new Intl.DateTimeFormat(locale(), opts).format(date);
  } catch {
    return raw;
  }
}

export const year = (raw: unknown): string =>
  typeof raw === "string" && /^\d{4}/.test(raw) ? raw.slice(0, 4) : "";

export function formatNumber(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat(locale()).format(n);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${locale().startsWith("fr") ? "o" : "B"}`;
  const units = ["Ko", "Mo", "Go"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const isFr = locale().startsWith("fr");
  const label = isFr ? units[u] : units[u].replace("o", "B");
  const n = new Intl.NumberFormat(locale(), { maximumFractionDigits: v < 10 ? 1 : 0, minimumFractionDigits: v < 10 ? 1 : 0 });
  return `${n.format(v)} ${label}`;
}

/** Pages d'une histoire : entières, fraction, ou les deux (« 10 ½ »). */
export function formatPages(pages: unknown, num?: unknown, den?: unknown): string {
  const p = typeof pages === "number" && pages > 0 ? pages : 0;
  const n = typeof num === "number" ? num : 0;
  const d = typeof den === "number" ? den : 0;
  const frac = n > 0 && d > 0 ? fraction(n, d) : "";
  if (!p && !frac) return "";
  if (!p) return frac;
  return frac ? `${p} ${frac}` : String(p);
}

function fraction(n: number, d: number): string {
  const glyph: Record<string, string> = {
    "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
    "1/5": "⅕", "1/6": "⅙", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
  };
  return glyph[`${n}/${d}`] ?? `${n}/${d}`;
}

/** Années d'activité « 1938–2026 », ou une seule année. */
export function yearSpan(first: unknown, last: unknown): string {
  const a = year(first);
  const b = year(last);
  if (!a && !b) return "";
  if (!a || !b || a === b) return a || b;
  return `${a}–${b}`;
}
