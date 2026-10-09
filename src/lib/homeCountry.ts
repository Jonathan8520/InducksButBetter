import { useTranslation } from "react-i18next";
import { settings } from "./store";

/** Pays « de chez soi » déduit de la langue, quand le visiteur n'en a pas choisi. */
const LANG_COUNTRY: Record<string, string> = {
  fr: "fr", en: "us", de: "de", it: "it", es: "es", pt: "br", nl: "nl", da: "dk", sv: "se",
  fi: "fi", no: "no", nb: "no", pl: "pl", el: "gr",
};

export function useHomeCountry(): string {
  const { i18n } = useTranslation();
  const chosen = settings.use((s) => s.country);
  return chosen || LANG_COUNTRY[(i18n.resolvedLanguage || "en").split("-")[0]] || "us";
}
