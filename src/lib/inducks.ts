/**
 * Vocabulaire Inducks : rôles, types d'histoire, images, pays et langues.
 */
import i18n from "../i18n";

// --- Rôles ------------------------------------------------------------------------------
// plotwritartink : p synopsis, w scénario, a crayonné, i encrage, r « fait référence à »
// (l'histoire cite l'auteur sans qu'il y ait travaillé).

export type Role = "p" | "w" | "a" | "i" | "r";
export const ROLE_ORDER: Role[] = ["p", "w", "a", "i", "r"];

export interface Credit {
  role: Role;
  code: string;
}

/** « p:CB;w:CB;a:CB;i:CB » -> crédits dans l'ordre d'affichage, inconnus écartés. */
export function parseCredits(raw: unknown): Credit[] {
  if (typeof raw !== "string" || !raw) return [];
  const out: Credit[] = [];
  for (const part of raw.split(";")) {
    const i = part.indexOf(":");
    if (i < 1) continue;
    const role = part.slice(0, i) as Role;
    const code = part.slice(i + 1).trim();
    if (!code || code === "?" || code === "-") continue;
    if (!ROLE_ORDER.includes(role)) continue;
    out.push({ role, code });
  }
  return out.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
}

/** Regroupe en « écriture » (p, w) et « dessin » (a, i), sans doublon de personne. */
export function writersArtists(credits: Credit[]) {
  const writers: string[] = [];
  const artists: string[] = [];
  for (const c of credits) {
    if ((c.role === "p" || c.role === "w") && !writers.includes(c.code)) writers.push(c.code);
    if ((c.role === "a" || c.role === "i") && !artists.includes(c.code)) artists.push(c.code);
  }
  return { writers, artists };
}

/** Une personne avec la liste de ses rôles sur une histoire. */
export function creditsByPerson(credits: Credit[]): { code: string; roles: Role[] }[] {
  const map = new Map<string, Role[]>();
  for (const c of credits) {
    const roles = map.get(c.code) ?? [];
    if (!roles.includes(c.role)) roles.push(c.role);
    map.set(c.code, roles);
  }
  return [...map.entries()].map(([code, roles]) => ({
    code,
    roles: roles.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)),
  }));
}

export const roleLabel = (r: string) => i18n.t(`roles.${r}`, { defaultValue: r });

/** « Scénario et dessin », « Crayonné, encrage »… */
export function rolesLabel(roles: string[]): string {
  const set = new Set(roles);
  const writes = set.has("p") || set.has("w");
  const draws = set.has("a") || set.has("i");
  if (set.has("p") && set.has("w") && set.has("a") && set.has("i")) return i18n.t("roles.all");
  if (writes && draws && set.size === 4) return i18n.t("roles.all");
  return roles.map((r) => roleLabel(r)).join(", ");
}

// --- Types d'histoire ------------------------------------------------------------------

export const KINDS = ["n", "k", "g", "c", "i", "t", "a", "f", "q", "P", "L"] as const;
export const kindLabel = (k: unknown) =>
  typeof k === "string" && k ? i18n.t(`kinds.${k}`, { defaultValue: k }) : "";

// --- Images -------------------------------------------------------------------------------
// La colonne `img` vaut « 2021/12/x.jpg » (site webusers, le plus fréquent) ou
// « site|chemin ». Les images passent par hr.php, le service de redimensionnement
// d'Inducks, qui répond sans contrôle anti-robot et pose le bon référent.

const OUTDUCKS = "https://outducks.org";

function sourceUrl(img: string): { site: string; path: string } {
  const i = img.indexOf("|");
  if (i === -1) return { site: "webusers", path: img };
  return { site: img.slice(0, i), path: img.slice(i + 1) };
}

function hr(url: string, small: boolean) {
  return `https://inducks.org/hr.php?image=${encodeURIComponent(url)}${small ? "&normalsize=1" : ""}`;
}

/** Vignette légère (listes, grilles). */
export function thumbUrl(img: unknown): string | null {
  if (typeof img !== "string" || !img) return null;
  const { site, path } = sourceUrl(img);
  if (site.startsWith("thumbnails")) return hr(`${OUTDUCKS}/${site}/${path}`, true);
  return hr(`${OUTDUCKS}/thumbnails/${site}/${path}`, true);
}

/** Image en taille réelle (zoom). */
export function fullUrl(img: unknown): string | null {
  if (typeof img !== "string" || !img) return null;
  const { site, path } = sourceUrl(img);
  if (site === "webusers") return hr(`${OUTDUCKS}/webusers/webusers/${path}`, false);
  return hr(`${OUTDUCKS}/${site}/${path}`, false);
}

/** Image intermédiaire (fiche d'histoire, couverture d'un numéro). */
export function mediumUrl(img: unknown): string | null {
  if (typeof img !== "string" || !img) return null;
  const { site, path } = sourceUrl(img);
  if (site === "webusers") return hr(`${OUTDUCKS}/webusers/webusers/${path}`, true);
  return hr(`${OUTDUCKS}/${site}/${path}`, true);
}

// --- Pays et langues -----------------------------------------------------------------------

const regionNames = new Map<string, Intl.DisplayNames | null>();
const languageNames = new Map<string, Intl.DisplayNames | null>();

function displayNames(cache: Map<string, Intl.DisplayNames | null>, type: "region" | "language") {
  const lang = i18n.resolvedLanguage || "en";
  if (!cache.has(lang)) {
    try {
      cache.set(lang, new Intl.DisplayNames([lang], { type }));
    } catch {
      cache.set(lang, null);
    }
  }
  return cache.get(lang);
}

/** Codes pays Inducks qui ne sont pas des régions ISO. */
const SPECIAL_COUNTRIES: Record<string, string> = { zz: "—" };

export function countryName(code: unknown, fallback?: unknown): string {
  if (typeof code !== "string" || !code) return "";
  if (SPECIAL_COUNTRIES[code]) return typeof fallback === "string" ? fallback : code;
  const dn = displayNames(regionNames, "region");
  try {
    const name = dn?.of(code.toUpperCase());
    if (name && name.toUpperCase() !== code.toUpperCase()) return name;
  } catch {
    /* code non ISO */
  }
  return typeof fallback === "string" && fallback ? fallback : code.toUpperCase();
}

export function languageName(code: unknown): string {
  if (typeof code !== "string" || !code) return "";
  const dn = displayNames(languageNames, "language");
  try {
    const name = dn?.of(code);
    if (name) return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  } catch {
    /* code non BCP 47 */
  }
  return code;
}

/** Le pays d'un code de numéro ou de publication : « fr/PM  272 » -> « fr ». */
export const countryOf = (code: string) => code.split("/")[0];

/** Langue des données préférée : celle de l'interface, avec quelques équivalences. */
export function dataLanguages(): string[] {
  const lang = (i18n.resolvedLanguage || "en").split("-")[0];
  return [lang, "en"];
}
