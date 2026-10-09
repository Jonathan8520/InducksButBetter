import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import fr from "./fr";
import en from "./en";

export const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
] as const;

/** Les autres langues ne sont chargées que si on les utilise. */
const LAZY: Record<string, () => Promise<{ default: unknown }>> = {
  de: () => import("./de"),
  it: () => import("./it"),
  es: () => import("./es"),
  pt: () => import("./pt"),
  nl: () => import("./nl"),
};

export async function loadLanguage(lng: string): Promise<void> {
  const base = lng.split("-")[0];
  const load = LAZY[base];
  if (!load || i18n.hasResourceBundle(base, "translation")) return;
  const mod = await load();
  i18n.addResourceBundle(base, "translation", mod.default as object, true, true);
}

export async function setLanguage(lng: string): Promise<void> {
  await loadLanguage(lng);
  await i18n.changeLanguage(lng);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    partialBundledLanguages: true,
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "ibb.lang",
      caches: ["localStorage"],
    },
    returnNull: false,
    // Les langues autres que fr et en arrivent après le premier rendu : les composants déjà
    // affichés (menu, barre du haut, pied de page) doivent se redessiner à leur arrivée.
    react: { bindI18n: "languageChanged loaded", bindI18nStore: "added" },
  })
  .then(() => {
    const lng = i18n.language;
    if (lng && LAZY[lng.split("-")[0]]) {
      void loadLanguage(lng).then(() => i18n.changeLanguage(lng));
    }
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.resolvedLanguage || "en";

export default i18n;
