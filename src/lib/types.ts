export interface MetaData {
  languages: { languagecode: string; languagename: string }[];
  kinds: string[];
  countries: { countrycode: string; countryname: string }[];
  universes: { universecode: string; universename: string }[];
  subseries: { value: string; label: string; group: string }[];
}

export const COUNTRY_CONTINENTS: Record<string, string> = {
  // Europe
  'al': 'europe', 'at': 'europe', 'by': 'europe', 'be': 'europe', 'bg': 'europe',
  'hr': 'europe', 'cz': 'europe', 'dk': 'europe', 'ee': 'europe', 'fi': 'europe',
  'fr': 'europe', 'de': 'europe', 'gr': 'europe', 'hu': 'europe', 'is': 'europe',
  'ie': 'europe', 'it': 'europe', 'lv': 'europe', 'lt': 'europe', 'lu': 'europe',
  'mt': 'europe', 'md': 'europe', 'me': 'europe', 'nl': 'europe', 'no': 'europe',
  'pl': 'europe', 'pt': 'europe', 'ro': 'europe', 'ru': 'europe', 'rs': 'europe',
  'sk': 'europe', 'si': 'europe', 'es': 'europe', 'se': 'europe', 'ch': 'europe',
  'tr': 'europe', 'ua': 'europe', 'uk': 'europe', 'yu': 'europe', 'cs': 'europe', 'ddr': 'europe',
  'gb': 'europe', 'ba': 'europe', 'mk': 'europe', 'gi': 'europe', 'ad': 'europe', 'sm': 'europe', 'fo': 'europe',

  // Amériques
  'ar': 'americas', 'bb': 'americas', 'br': 'americas', 'ca': 'americas',
  'cl': 'americas', 'co': 'americas', 'cr': 'americas', 'cu': 'americas',
  'sv': 'americas', 'gt': 'americas', 'mx': 'americas', 'ni': 'americas',
  'pa': 'americas', 'pe': 'americas', 'tt': 'americas', 'us': 'americas',
  'uy': 'americas', 've': 'americas', 'bo': 'americas', 'ec': 'americas', 'py': 'americas', 'gy': 'americas', 'an': 'americas', 'hn': 'americas',

  // Asie
  'cn': 'asia', 'cy': 'asia', 'ge': 'asia', 'in': 'asia', 'id': 'asia',
  'ir': 'asia', 'il': 'asia', 'jp': 'asia', 'kz': 'asia', 'lb': 'asia',
  'my': 'asia', 'ph': 'asia', 'sg': 'asia', 'kr': 'asia', 'lk': 'asia',
  'sy': 'asia', 'tw': 'asia', 'th': 'asia', 'ae': 'asia', 'vn': 'asia',
  'hk': 'asia', 'mo': 'asia', 'pk': 'asia', 'sa': 'asia', 'kw': 'asia', 'mn': 'asia',

  // Afrique
  'dz': 'africa', 'eg': 'africa', 'ma': 'africa', 'za': 'africa',
  'tn': 'africa', 'ke': 'africa', 'ng': 'africa', 'ci': 'africa', 'sn': 'africa',

  // Océanie
  'au': 'oceania', 'nz': 'oceania', 'fj': 'oceania', 'pg': 'oceania', 'nc': 'oceania', 'pf': 'oceania'
};
