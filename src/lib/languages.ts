/**
 * Master list of all **actively displayed** interface languages.
 *
 * A language should only appear here once its Crowdin translation has
 * reached a meaningful coverage (> 0%). The locale files for all other
 * languages still exist in /public/locales/ so i18next can load them
 * whenever they become available — just add the entry below.
 *
 * Currently active (translated):
 *   fr, en
 *
 * Waiting for Crowdin translators (0% coverage — DO NOT add to UI yet):
 *   de, es, it, pt, nl, da, sv, fi, id
 */
export interface SupportedLanguage {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "fr", name: "Français (FR)",   flag: "https://flagcdn.com/w20/fr.png" },
  { code: "en", name: "English (US)",    flag: "https://flagcdn.com/w20/us.png" },
  { code: "de", name: "Deutsch (DE)",    flag: "https://flagcdn.com/w20/de.png" },
  { code: "es", name: "Español (ES)",    flag: "https://flagcdn.com/w20/es.png" },
  { code: "it", name: "Italiano (IT)",   flag: "https://flagcdn.com/w20/it.png" },
  { code: "pt", name: "Português (PT)",  flag: "https://flagcdn.com/w20/pt.png" },
  // Uncomment each entry once its Crowdin coverage is sufficient:
  // { code: "nl", name: "Nederlands (NL)", flag: "https://flagcdn.com/w20/nl.png" },
  // { code: "da", name: "Dansk (DA)",      flag: "https://flagcdn.com/w20/dk.png" },
  // { code: "sv", name: "Svenska (SV)",    flag: "https://flagcdn.com/w20/se.png" },
  // { code: "fi", name: "Suomi (FI)",      flag: "https://flagcdn.com/w20/fi.png" },
  // { code: "id", name: "Indonesia (ID)",  flag: "https://flagcdn.com/w20/id.png" },
];

/** Fallback language if the browser/stored code is not in the list. */
export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[1]; // "en"

/**
 * Returns the SupportedLanguage entry for the given BCP-47 code,
 * stripping the region subtag (e.g. "en-US" → "en").
 * Falls back to DEFAULT_LANGUAGE when not found.
 */
export function resolveLanguage(bcp47: string): SupportedLanguage {
  const code = (bcp47 || "en").split("-")[0].toLowerCase();
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? DEFAULT_LANGUAGE;
}

