/**
 * Construction des URL. Les codes Inducks contiennent des espaces significatifs
 * (« W OS  386-02 ») : ils deviennent des « + », lisibles et réversibles.
 */
const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");
export const decodeSegment = (s: string) => decodeURIComponent(s.replace(/\+/g, "%20"));

/** « fr/PM  272 » -> { pub: "fr/PM", number: "272" } à partir du code de publication. */
export function splitIssue(issuecode: string, publicationcode?: string | null) {
  if (publicationcode && issuecode.startsWith(publicationcode)) {
    return { pub: publicationcode, number: issuecode.slice(publicationcode.length).trim() };
  }
  const m = issuecode.match(/^(\S+?)\s+(.*)$/);
  if (m) return { pub: m[1], number: m[2].trim() };
  return { pub: issuecode, number: "" };
}

export const routes = {
  home: () => "/",
  search: (params?: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/search?${s}` : "/search";
  },
  story: (code: string) => `/stories/${enc(code)}`,
  issue: (issuecode: string, publicationcode?: string | null) => {
    const { pub, number } = splitIssue(issuecode, publicationcode);
    const [country, ...rest] = pub.split("/");
    return `/issues/${enc(country)}/${enc(rest.join("/"))}/${enc(number)}`;
  },
  publication: (code: string) => {
    const [country, ...rest] = code.split("/");
    return `/publications/${enc(country)}/${enc(rest.join("/"))}`;
  },
  countries: () => "/countries",
  country: (code: string) => `/countries/${enc(code)}`,
  creators: () => "/creators",
  creator: (code: string) => `/creators/${enc(code)}`,
  characters: () => "/characters",
  character: (code: string) => `/characters/${enc(code)}`,
  universes: () => "/universes",
  universe: (code: string) => `/universes/${enc(code)}`,
  subseriesList: () => "/series",
  subseries: (code: string) => `/series/${enc(code)}`,
  publisher: (id: string) => `/publishers/${enc(id)}`,
  collection: () => "/collection",
  lab: () => "/lab",
  settings: () => "/settings",
  about: () => "/about",
};

/** Lien vers la page correspondante sur inducks.org. */
export const inducksUrl = {
  story: (code: string) => `https://inducks.org/story.php?c=${encodeURIComponent(code)}`,
  issue: (code: string) => `https://inducks.org/issue.php?c=${encodeURIComponent(code)}`,
  publication: (code: string) => `https://inducks.org/publication.php?c=${encodeURIComponent(code)}`,
  creator: (code: string) => `https://inducks.org/creator.php?c=${encodeURIComponent(code)}`,
  character: (code: string) => `https://inducks.org/character.php?c=${encodeURIComponent(code)}`,
  country: (code: string) => `https://inducks.org/country.php?c=${encodeURIComponent(code)}`,
  publisher: (id: string) => `https://inducks.org/publisher.php?c=${encodeURIComponent(id)}`,
  subseries: (code: string) => `https://inducks.org/subseries.php?c=${encodeURIComponent(code)}`,
  universe: (code: string) => `https://inducks.org/universe.php?c=${encodeURIComponent(code)}`,
};
