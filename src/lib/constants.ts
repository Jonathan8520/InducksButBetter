/**
 * Common languages to fallback to if the DB table is empty or API fails.
 */
export const COMMON_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "Anglais" },
  { code: "de", label: "Allemand" },
  { code: "it", label: "Italien" },
  { code: "es", label: "Espagnol" },
  { code: "nl", label: "Néerlandais" },
  { code: "da", label: "Danois" },
  { code: "fi", label: "Finnois" },
  { code: "no", label: "Norvégien" },
  { code: "sv", label: "Suédois" },
  { code: "pt", label: "Portugais" },
  { code: "el", label: "Grec" },
  { code: "pl", label: "Polonais" },
  { code: "ru", label: "Russe" },
  { code: "jp", label: "Japonais" }
];

/**
 * Common nationalities for filtering authors.
 */
export const AUTHOR_NATIONALITIES = [
  { code: "any", label: "N'importe" },
  { code: "ar", label: "Argentine" }, 
  { code: "au", label: "Australie" },
  { code: "be", label: "Belgique" }, 
  { code: "br", label: "Brésil" },
  { code: "ca", label: "Canada" }, 
  { code: "ch", label: "Suisse" },
  { code: "cl", label: "Chili" }, 
  { code: "co", label: "Colombie" },
  { code: "cz", label: "République Tchèque" }, 
  { code: "de", label: "Allemagne" },
  { code: "dk", label: "Danemark" }, 
  { code: "eg", label: "Égypte" },
  { code: "es", label: "Espagne" }, 
  { code: "fi", label: "Finlande" },
  { code: "fr", label: "France" }, 
  { code: "hr", label: "Croatie" },
  { code: "hu", label: "Hongrie" }, 
  { code: "ie", label: "Irlande" },
  { code: "it", label: "Italie" }, 
  { code: "jp", label: "Japon" },
  { code: "mx", label: "Mexique" }, 
  { code: "nl", label: "Pays-Bas" },
  { code: "no", label: "Norvège" }, 
  { code: "nz", label: "Nouvelle-Zélande" },
  { code: "pe", label: "Pérou" }, 
  { code: "ph", label: "Philippines" },
  { code: "pl", label: "Pologne" }, 
  { code: "ru", label: "Russe" },
  { code: "se", label: "Suède" }, 
  { code: "tr", label: "Turquie" },
  { code: "uk", label: "Royaume-Uni" }, 
  { code: "us", label: "États-Unis" },
  { code: "uy", label: "Uruguay" }, 
  { code: "yu", label: "Yougoslavie" },
];

/**
 * Content type labels (Kinds).
 */
export const KIND_LABELS: Record<string, string> = {
  n: "Histoire",
  k: "Bande quotidienne, hebdomadaire",
  c: "Couverture",
  i: "Illustration",
  g: "Jeu",
  a: "Article",
  t: "Texte",
  f: "Double page centrale",
  P: "Peinture (portrait)",
  L: "Peinture (paysage)",
};
