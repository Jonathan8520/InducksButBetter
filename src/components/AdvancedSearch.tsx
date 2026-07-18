import React, { useState, useEffect } from "react"
import { Search, X, Loader2, BookOpen, User, Users, Database as DbIcon, LibraryBig, Calendar, Hash, Languages, Globe, Plus, ChevronDown, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Autocomplete } from "@/components/Autocomplete"
import { MultiAutocomplete } from "@/components/MultiAutocomplete"
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect"
import { CollectionManagerDialog } from "./CollectionManagerDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { useTranslation } from "react-i18next"
import { DateRangePicker } from "@/components/DateRangePicker"
import { DateRange } from "react-day-picker"
import { parseISO, format } from "date-fns"
import { tursoClient, autocompleteStorycode, autocompleteCharacter, autocompletePerson, autocompletePublisher } from "@/lib/turso"
import { buildAdvancedSearchQuery } from "@/lib/searchService"
import { toast } from "sonner"

const COUNTRY_CONTINENTS: Record<string, string> = {
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
import { StoryResultCard } from "@/components/StoryResultCard"
import StoryResultSkeleton from "@/components/StoryResultSkeleton"
import { cn } from "@/lib/utils"
import { AUTHOR_NATIONALITIES, COMMON_LANGUAGES, KIND_LABELS } from "@/lib/constants"

export interface MetaData {
  languages: { languagecode: string; languagename: string }[];
  kinds: string[];
  countries: { countrycode: string; countryname: string }[];
  universes: { universecode: string; universename: string }[];
  subseries: { value: string; label: string; group: string; description?: string }[];
}

export interface PersonRole {
  id: string;
  code: string;
  role: string;
}

export interface SearchFilters {
  title: string;
  description: string;
  includeComments: boolean;
  storycode: string;
  charactercode: string[];
  excludeCharactercode: string[];
  personRoles: PersonRole[];
  excludePersoncode: string[];
  publisherid: string;
  kind: string[];
  pagesMin: number;
  pagesMax: number;
  pagesExact: string;
  rowsperpage: string;
  panelsperstrip: string;
  stripsperpage: string;
  language: string[];
  country: string[];
  herocode: string[];
  onlyCollection: boolean;
  dateAfter: string;
  dateBefore: string;
  nationality: string[];
  universes: string[];
  subseriescode: string[];
  noOtherCharacters: boolean;
  sort: string;
  page: number;
  indexingIncomplete?: boolean;
  multipleParts?: boolean;
  hasImage?: 'all' | 'yes' | 'no';
}

export const initialFilters: SearchFilters = {
  title: "",
  description: "",
  includeComments: false,
  storycode: "",
  charactercode: [],
  excludeCharactercode: [],
  personRoles: [{ id: "init", code: "", role: "any" }],
  excludePersoncode: [],
  publisherid: "",
  kind: [],
  pagesMin: 0,
  pagesMax: 500,
  pagesExact: "",
  rowsperpage: "24",
  panelsperstrip: "",
  stripsperpage: "",
  language: [],
  country: [],
  herocode: [],
  onlyCollection: false,
  dateAfter: "",
  dateBefore: "",
  nationality: [],
  universes: [],
  subseriescode: [],
  noOtherCharacters: false,
  sort: "pubdate_asc",
  page: 1,
  indexingIncomplete: false,
  multipleParts: false,
  hasImage: 'all',
};

export function AdvancedSearch() {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)

  const [pagesSliderMoved, setPagesSliderMoved] = useState(false)

  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({})
  const [results, setResults] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [lastSearchFilters, setLastSearchFilters] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [cookieValue, setCookieValue] = useState("")
  const [isSavingCookie, setIsSavingCookie] = useState(false)
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [meta, setMeta] = useState<MetaData>({
    languages: [], kinds: [], countries: [],
    universes: [], subseries: []
  });

  const nationalities = AUTHOR_NATIONALITIES;

  useEffect(() => {
    const currentLang = i18n.language || 'fr';
    // Méta-données codées en dur ou récupérées d'une source locale pour éviter le backend
    // Les listes complètes sont déjà dans CONSTANTS ou nous les laisserons telles quelles.
    // Pour une version entièrement statique sans backend, nous pourrions faire des requêtes Turso:
    const loadMeta = async () => {
      const cacheKey = `inducks_meta_${currentLang}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setMeta(JSON.parse(cached));
        return;
      }

      try {
        const [kindsRes, countriesRes, universesRes, subseriesRes] = await Promise.all([
          tursoClient.execute("SELECT DISTINCT kind FROM inducks_storyversion WHERE kind IS NOT NULL"),
          tursoClient.execute({ sql: "SELECT c.countrycode, COALESCE(cn.countryname, c.countryname) as countryname FROM inducks_country c LEFT JOIN inducks_countryname cn ON c.countrycode = cn.countrycode AND cn.languagecode = ? ORDER BY countryname", args: [currentLang] }),
          tursoClient.execute("SELECT universecode, universecomment as universename FROM inducks_universe ORDER BY universecomment"),
          tursoClient.execute({ sql: "SELECT subseriescode, subseriesname as label FROM inducks_subseriesname WHERE languagecode = ? OR languagecode = 'en' GROUP BY subseriescode ORDER BY CASE WHEN languagecode = ? THEN 0 ELSE 1 END, subseriesname", args: [currentLang, currentLang] })
        ]);
        
        const metaObj = {
          languages: COMMON_LANGUAGES.map(l => ({ languagecode: l.code, languagename: l.label })),
          kinds: kindsRes.rows.map((r: any) => String(r.kind)),
          countries: countriesRes.rows.map((r: any) => ({ countrycode: String(r.countrycode), countryname: String(r.countryname) })),
          universes: universesRes.rows.map((r: any) => ({ universecode: String(r.universecode), universename: String(r.universename) })),
          subseries: subseriesRes.rows.map((r: any) => ({ value: String(r.subseriescode), label: String(r.label), group: "Series" }))
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(metaObj));
        setMeta(metaObj);
      } catch (err) {
        console.error("Failed to load meta from Turso:", err);
        setMeta(prev => ({ ...prev, languages: COMMON_LANGUAGES.map(l => ({ languagecode: l.code, languagename: l.label })) }));
      }
    };
    loadMeta();
  }, [])

  useEffect(() => {
    if (lastSearchFilters) {
      performSearch(lastSearchFilters);
    }
  }, [i18n.language]);

  const performSearch = async (searchFilters: any) => {
    setLoading(true);
    try {
      const filtersForQuery = {
        ...searchFilters,
        charactercode: searchFilters.charactercode.join(","),
        herocode: searchFilters.herocode.join(","),
        excludeCharactercode: searchFilters.excludeCharactercode.join(","),
        personRoles: searchFilters.personRoles.filter((pr: any) => pr.code !== ""),
        excludePersoncode: searchFilters.excludePersoncode.filter(Boolean),
        nationality: searchFilters.nationality.join(","),
        universes: searchFilters.universes.join(","),
        subseriescode: searchFilters.subseriescode.join(","),
        lang: i18n.language,
        noOtherCharacters: searchFilters.noOtherCharacters,
        country: searchFilters.country.join(","),
        language: searchFilters.language.join(","),
        kind: searchFilters.kind.join(","),
        pagesMax: pagesSliderMoved ? searchFilters.pagesMax : undefined,
      };

      const { query, countQuery, params, countParams } = buildAdvancedSearchQuery(filtersForQuery);

      const [countResult, rowsResult] = await Promise.all([
        tursoClient.execute({ sql: countQuery, args: countParams }),
        tursoClient.execute({ sql: query, args: params })
      ]);

      setResults(rowsResult.rows as any[]);
      setTotalCount(Number(countResult.rows[0]?.total || countResult.rows[0]?.COUNT || 0));

    } catch (err) {
      console.error(err);
      toast.error(t('search.error_fetch', { defaultValue: 'Erreur: impossible de récupérer les données.' }));
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = async (e?: React.FormEvent | null, overrideFilters?: any) => {
    if (e) e.preventDefault();
    const currentFilters = overrideFilters || filters;
    setLastSearchFilters(currentFilters);
    await performSearch(currentFilters);
  }

  const saveCookie = async () => {
    setIsSavingCookie(true)
    try {
      const res = await fetch("/api/settings/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue })
      })
      if (res.ok) {
        setIsSettingsOpen(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingCookie(false)
    }
  }

  const addSelection = (key: 'charactercode' | 'herocode' | 'excludeCharactercode', value: string, label: string) => {
    if (!(filters[key] as string[]).includes(value)) {
      setFilters({ ...filters, [key]: [...(filters[key] as string[]), value] })
      setSelectedLabels({ ...selectedLabels, [value]: label })
    }
  }

  const removeSelection = (key: 'charactercode' | 'herocode' | 'excludeCharactercode', value: string) => {
    setFilters({ ...filters, [key]: (filters[key] as string[]).filter((v: string) => v !== value) })
  }

  return (
    <div className="h-full flex flex-col overflow-auto lg:overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 lg:p-8 gap-8 px-4 lg:px-12">
        <Card className="flex-1 flex flex-col border-border-subtle/60 dark:border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface min-h-[600px] lg:min-h-0">
          <div className="px-8 py-5 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-3">
              {t('search.title')}
            </h2>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-text-body">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Paramètres Inducks</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="cookie">Cookie Inducks (coa-session, etc.)</Label>
                    <Input
                      id="cookie"
                      placeholder="Collez votre cookie ici..."
                      value={cookieValue}
                      onChange={(e) => setCookieValue(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Ce cookie permet d'accéder aux images haute résolution. Récupérez-le dans l'onglet Application &gt; Cookies de l'inspecteur sur <a href="https://inducks.org" target="_blank" className="text-blue-500 underline">inducks.org</a>.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={saveCookie} disabled={isSavingCookie}>
                    {isSavingCookie ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-8">
              <form onSubmit={handleSearch} className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-7">
                {/* Row: Code & Keywords */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.inducks_code')}</Label>
                  <Autocomplete
                    value={filters.storycode}
                    placeholder={t('search.inducks_code_placeholder')}
                    emptyMessage={t('common.no_data')}
                    fetchOptions={(q) => autocompleteStorycode(q, i18n.language)}
                    onSelect={(val) => setFilters({ ...filters, storycode: val })}
                    onInputChange={(val) => setFilters({ ...filters, storycode: val })}
                    onClear={() => setFilters({ ...filters, storycode: "" })}
                    type="stories"
                    hideIcon={true}
                    hideSearchIcon={true}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.keywords')}</Label>
                  <Input
                    placeholder={t('search.keywords_placeholder')}
                    value={filters.title}
                    onChange={(e) => setFilters({ ...filters, title: e.target.value })}
                    className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all hover:bg-surface-2 placeholder:text-text-hint"
                  />
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                      <Checkbox
                        id="comments"
                        checked={filters.includeComments}
                        onCheckedChange={(checked) => setFilters({ ...filters, includeComments: checked === true })}
                      />
                      <label htmlFor="comments" className="text-xs text-text-secondary cursor-pointer leading-snug">
                        {t('search.include_comments')}
                      </label>
                    </div>
                    <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                      <Checkbox
                        id="multiple-parts"
                        checked={filters.multipleParts === true}
                        onCheckedChange={(checked) => setFilters({ ...filters, multipleParts: checked === true })}
                      />
                      <label htmlFor="multiple-parts" className="text-xs text-text-secondary cursor-pointer leading-snug">
                        {t('search.multiple_parts')}
                      </label>
                    </div>
                  </div>
                </div>

                 <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('search.content_type')}</Label>
                    <SearchableMultiSelect
                      options={Object.entries(KIND_LABELS).map(([code, label]) => ({
                        value: code,
                        label: label
                      }))}
                      selected={filters.kind}
                      onChange={(val) => setFilters({ ...filters, kind: val })}
                      placeholder={t('search.all_types')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Affichage</Label>
                    <Select value={filters.hasImage || "all"} onValueChange={(val) => setFilters({ ...filters, hasImage: val as any })}>
                      <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                        <SelectValue placeholder="Toutes les histoires" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les histoires</SelectItem>
                        <SelectItem value="yes">Avec image uniquement</SelectItem>
                        <SelectItem value="no">Sans image uniquement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row: Date Range Picker */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.publication_period')}</Label>
                  <DateRangePicker
                    date={{
                      from: filters.dateAfter ? parseISO(filters.dateAfter) : undefined,
                      to: filters.dateBefore ? parseISO(filters.dateBefore) : undefined
                    }}
                    setDate={(range) => {
                      setFilters({
                        ...filters,
                        dateAfter: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                        dateBefore: range?.to ? format(range.to, "yyyy-MM-dd") : ""
                      })
                    }}
                  />
                </div>

                {/* Row: Publisher & Country */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.publisher')}</Label>
                  <Autocomplete
                    value={filters.publisherid}
                    placeholder={t('search.publisher_placeholder')}
                    emptyMessage={t('common.no_data')}
                    fetchOptions={autocompletePublisher}
                    onSelect={(val) => setFilters({ ...filters, publisherid: val })}
                    onInputChange={(val) => setFilters({ ...filters, publisherid: val })}
                    onClear={() => setFilters({ ...filters, publisherid: "" })}
                    type="publishers"
                    hideIcon={true}
                    hideSearchIcon={true}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="collection"
                      checked={filters.onlyCollection}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setFilters({ ...filters, onlyCollection: isChecked });
                        if (isChecked) {
                          try {
                            const saved = localStorage.getItem("inducks_collection_issues");
                            const parsed = saved ? JSON.parse(saved) : [];
                            if (!Array.isArray(parsed) || parsed.length === 0) {
                              setCollectionDialogOpen(true);
                            }
                          } catch (e) {
                            setCollectionDialogOpen(true);
                          }
                        }
                      }}
                    />
                    <label htmlFor="collection" className="text-[12px] text-text-secondary cursor-pointer flex-1">
                      {t('search.only_collection')}
                    </label>
                    <button 
                      onClick={() => setCollectionDialogOpen(true)}
                      className="p-1 text-text-secondary hover:text-text-body transition-colors rounded hover:bg-surface-2"
                      title="Gérer ma collection"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.publication_country')}</Label>
                  <SearchableMultiSelect
                    options={meta.countries.map((c: any) => ({
                      value: c.countrycode,
                      label: c.countryname,
                      group: t(`continents.${COUNTRY_CONTINENTS[c.countrycode.toLowerCase()] || 'other'}`),
                      icon: <img src={`https://flagcdn.com/w20/${c.countrycode.toLowerCase()}.png`} className="w-4 h-3 rounded-xs" alt="" />
                    }))}
                    selected={filters.country}
                    onChange={(vals) => setFilters({ ...filters, country: vals })}
                    placeholder={t('search.any_country')}
                    searchPlaceholder={t('search.search_country')}
                    emptyMessage={t('common.no_data')}
                  />
                </div>

                {/* Row: Language */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.publication_language')}</Label>
                  <SearchableMultiSelect
                    options={meta.languages.map((l: any) => ({
                      value: l.languagecode,
                      label: t(`languages.${l.languagecode}`),
                    }))}
                    selected={filters.language}
                    onChange={(vals) => setFilters({ ...filters, language: vals })}
                    placeholder={t('search.all_languages')}
                    searchPlaceholder={t('search.search_language')}
                    emptyMessage={t('common.no_data')}
                  />
                </div>

                <div className="col-span-2 space-y-3 pt-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.authors')}</Label>
                  <div className="flex flex-col gap-3">
                    {filters.personRoles.map((pr, idx) => (
                      <div key={pr.id} className="flex flex-col sm:flex-row items-center gap-2">
                        <div className="flex-1 w-full relative">
                          {pr.code ? (
                            <div className="h-10 border border-border-subtle rounded-xl bg-surface-2 flex items-center justify-between px-3">
                              <span className="text-sm font-medium">{selectedLabels[pr.code] || pr.code}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => {
                                const newRoles = [...filters.personRoles];
                                newRoles[idx].code = "";
                                setFilters({ ...filters, personRoles: newRoles });
                              }}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Autocomplete
                              value={pr.code}
                              placeholder={t('search.author_placeholder')}
                              emptyMessage={t('common.no_data')}
                              fetchOptions={autocompletePerson}
                              onSelect={(val, label) => {
                                const newRoles = [...filters.personRoles];
                                newRoles[idx].code = val;
                                setFilters({ ...filters, personRoles: newRoles });
                                setSelectedLabels({ ...selectedLabels, [val]: label });
                              }}
                              type="authors"
                            />
                          )}
                        </div>
                        <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <Select value={pr.role} onValueChange={(val) => {
                            const newRoles = [...filters.personRoles];
                            newRoles[idx].role = val;
                            setFilters({ ...filters, personRoles: newRoles });
                          }}>
                            <SelectTrigger className="flex-1 sm:w-[140px] h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                              <SelectValue placeholder={t('search.role')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">{t('roles.any')}</SelectItem>
                              <SelectItem value="p">{t('roles.p')}</SelectItem>
                              <SelectItem value="w">{t('roles.w')}</SelectItem>
                              <SelectItem value="a">{t('roles.a')}</SelectItem>
                              <SelectItem value="i">{t('roles.i')}</SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {filters.personRoles.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-text-secondary hover:text-red-500 shrink-0" onClick={() => {
                                setFilters({ ...filters, personRoles: filters.personRoles.filter((_, i) => i !== idx) });
                              }}>
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                            {idx === filters.personRoles.length - 1 && (
                              <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => {
                                setFilters({ ...filters, personRoles: [...filters.personRoles, { id: Date.now().toString(), code: "", role: "any" }] });
                              }}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Excluded Author & Nationality */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.not_author')}</Label>
                  <Autocomplete
                    value={filters.excludePersoncode[0] || ""}
                    placeholder={t('search.exclude_author_placeholder')}
                    emptyMessage={t('common.no_data')}
                    fetchOptions={autocompletePerson}
                    onSelect={(val) => setFilters({ ...filters, excludePersoncode: [val] })}
                    onClear={() => setFilters({ ...filters, excludePersoncode: [] })}
                    hideIcon={true}
                    hideSearchIcon={true}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('search.author_nationality')}</Label>
                  <SearchableMultiSelect
                    options={nationalities.filter(n => n.code !== 'any').map(n => ({
                      value: n.code,
                      label: t(`nationalities.${n.code}`),
                      group: t(`continents.${COUNTRY_CONTINENTS[n.code] || 'other'}`),
                      icon: <img src={`https://flagcdn.com/w20/${n.code === 'uk' ? 'gb' : n.code}.png`} className="w-4 h-3 rounded-xs object-cover" alt="" onError={(e) => e.currentTarget.style.display = 'none'} />
                    }))}
                    selected={Array.isArray(filters.nationality) ? filters.nationality : []}
                    onChange={(vals) => setFilters({ ...filters, nationality: vals })}
                    placeholder={t('search.any_country')}
                    searchPlaceholder={t('search.search_country')}
                    emptyMessage={t('common.no_data')}
                  />
                </div>

                {/* Characters & Universe Row */}
                <div className="col-span-2 grid grid-cols-2 gap-4 md:gap-8 pt-4 border-t border-border-subtle">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('search.heroes')}</Label>
                    <MultiAutocomplete
                      placeholder={t('search.heroes_placeholder')}
                      emptyMessage={t('common.no_data')}
                      fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                      selected={filters.herocode}
                      selectedLabels={selectedLabels}
                      onSelect={(val, label) => addSelection('herocode', val, label)}
                      onRemove={(val) => removeSelection('herocode', val)}
                      onClear={() => setFilters({ ...filters, herocode: [] })}
                      type="characters"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('search.universe')}</Label>
                    <SearchableMultiSelect
                      options={meta.universes.map(u => ({
                        value: u.universecode,
                        label: u.universename,
                      }))}
                      selected={Array.isArray(filters.universes) ? filters.universes : []}
                      onChange={(vals) => setFilters({ ...filters, universes: vals })}
                      placeholder={t('search.all_universes')}
                      searchPlaceholder={t('search.search_universe')}
                      emptyMessage={t('common.no_data')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('search.series')}</Label>
                    <SearchableMultiSelect
                      options={meta.subseries || []}
                      selected={filters.subseriescode || []}
                      onChange={(vals) => setFilters({ ...filters, subseriescode: vals })}
                      placeholder={t('search.all_series')}
                      searchPlaceholder={t('search.search_series')}
                      emptyMessage={t('common.no_data')}
                    />
                  </div>
                </div>

                {/* Character Presence Details */}
                <div className="col-span-2 grid grid-cols-2 gap-4 md:gap-8 py-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('search.characters')}</Label>
                    <MultiAutocomplete
                      placeholder={t('search.search_character_placeholder')}
                      emptyMessage={t('common.no_data')}
                      fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                      selected={filters.charactercode}
                      selectedLabels={selectedLabels}
                      onSelect={(val, label) => addSelection('charactercode', val, label)}
                      onRemove={(val) => removeSelection('charactercode', val)}
                      onClear={() => setFilters({ ...filters, charactercode: [] })}
                      type="characters"
                    />
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                        <Checkbox
                          id="no-others"
                          checked={filters.noOtherCharacters === true}
                          onCheckedChange={(checked) => setFilters({ ...filters, noOtherCharacters: checked === true })}
                        />
                        <label htmlFor="no-others" className="text-xs text-text-secondary cursor-pointer leading-snug">
                          {t('search.no_other_characters')}
                        </label>
                      </div>
                      <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                        <Checkbox
                          id="incomplete-indexing"
                          checked={filters.indexingIncomplete === true}
                          onCheckedChange={(checked) => setFilters({ ...filters, indexingIncomplete: checked === true })}
                        />
                        <label htmlFor="incomplete-indexing" className="text-xs text-text-secondary cursor-pointer">
                          {t('search.indexing_incomplete')}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground text-red-600">{t('search.exclude_character')}</Label>
                    <MultiAutocomplete
                      placeholder={t('search.exclude_character_placeholder')}
                      emptyMessage={t('common.no_data')}
                      fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                      selected={filters.excludeCharactercode}
                      selectedLabels={selectedLabels}
                      onSelect={(val, label) => addSelection('excludeCharactercode', val, label)}
                      onRemove={(val) => removeSelection('excludeCharactercode', val)}
                      onClear={() => setFilters({ ...filters, excludeCharactercode: [] })}
                      type="characters"
                    />
                  </div>
                </div>

                {/* Layout Row: Strips per page & Panels per strip */}
                <div className="col-span-2 grid grid-cols-2 gap-8 pt-4 border-t border-border-subtle">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('search.strips_per_page')}</Label>
                    <Select value={filters.stripsperpage || "all"} onValueChange={(val) => setFilters({ ...filters, stripsperpage: val })}>
                      <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                        <SelectValue placeholder={t('search.any')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">N'importe</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(v => (
                          <SelectItem key={v} value={String(v)}>{v} {t('search.strips_per_page').toLowerCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('search.panels_per_strip')}</Label>
                    <Select value={filters.panelsperstrip || "all"} onValueChange={(val) => setFilters({ ...filters, panelsperstrip: val })}>
                      <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                        <SelectValue placeholder={t('search.any')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('search.any')}</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(v => (
                          <SelectItem key={v} value={String(v)}>{v} vignettes</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pages Slider */}
                <div className="col-span-2 space-y-3 pt-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-foreground">{t('search.pages')}</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          placeholder={t('search.pages_exact')}
                          value={filters.pagesExact}
                          onChange={(e) => setFilters({ ...filters, pagesExact: e.target.value })}
                          className="h-10 w-24 text-sm font-medium border-border-subtle rounded-xl bg-surface shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all hover:bg-surface-2 placeholder:text-text-hint"
                        />
                        <span className="text-[10px] font-medium text-muted-foreground tracking-tight">{t('search.pages_exact')}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono font-medium bg-surface-2 px-2 py-0.5 rounded border border-border-subtle mb-1">
                      {filters.pagesMin} — {filters.pagesMax}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 py-3 pb-8">
                    <span className="text-xs font-medium text-muted-foreground w-4">0</span>
                    <Slider
                      value={[filters.pagesMin, filters.pagesMax]}
                      max={500}
                      step={1}
                      className="flex-1"
                      onValueChange={([min, max]) => {
                        setPagesSliderMoved(true)
                        setFilters({ ...filters, pagesMin: min, pagesMax: max })
                      }}
                    />
                    <span className="text-xs font-medium text-muted-foreground w-6">500</span>
                  </div>
                </div>
              </form>
            </div>
          </ScrollArea>

          <div className="p-4 lg:p-8 border-t border-border-subtle bg-surface flex flex-col sm:flex-row gap-4 shrink-0">
            <Button
              variant="outline"
              className="flex-1 h-12 border-border-subtle text-text-secondary font-medium text-sm bg-surface hover:bg-surface-2 hover:text-foreground transition-all rounded-2xl"
              onClick={() => {
                setFilters(initialFilters);
                setResults([]);
                setTotalCount(0);
                setSelectedLabels({});
              }}
            >
              {t('search.reset')}
            </Button>
            <Button
              className="flex-[1.5] h-12 bg-primary text-primary-foreground font-medium text-sm shadow-xl hover:bg-primary/90 transition-all rounded-2xl active:scale-[0.98]"
              onClick={() => handleSearch()}
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>{t('search.searching')}</span>
                </div>
              ) : <>{t('search.submit')}</>}
            </Button>
          </div>
        </Card>

        {/* Results Side */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex items-center justify-between mb-6 px-2 shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-bold tracking-tight text-text-body">{t('search.results')}</h2>
              {totalCount > 0 && (
                <Select value={filters.sort} onValueChange={(val) => {
                  const newFilters = { ...filters, sort: val, page: 1 };
                  setFilters(newFilters);
                  handleSearch(null, newFilters);
                }}>
                  <SelectTrigger className="h-10 border-border-subtle bg-surface/80 rounded-xl hover:bg-surface-2 transition-all font-medium text-sm">
                    <SelectValue placeholder={t('search.sort_by')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border-subtle bg-surface">
                    <SelectItem value="pubdate_desc" className="rounded-lg">{t('sort.pubdate_desc')}</SelectItem>
                    <SelectItem value="pubdate_asc" className="rounded-lg">{t('sort.pubdate_asc')}</SelectItem>
                    <SelectItem value="title_az" className="rounded-lg">{t('sort.title_az')}</SelectItem>
                    <SelectItem value="title_za" className="rounded-lg">{t('sort.title_za')}</SelectItem>
                    <SelectItem value="pages_desc" className="rounded-lg">{t('sort.pages_desc')}</SelectItem>
                    <SelectItem value="pages_asc" className="rounded-lg">{t('sort.pages_asc')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {totalCount > 0 && <Badge variant="secondary" className="bg-primary text-primary-foreground border-none px-3 font-bold">{t('search.stories_found', { count: totalCount })}</Badge>}
          </div>

          <div className="flex-1 min-h-0">
            {loading ? (
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-1 gap-6 pb-12 opacity-70">
                  {[1, 2, 3, 4].map(i => (
                    <StoryResultSkeleton key={i} />
                  ))}
                </div>
              </ScrollArea>
            ) : results.length > 0 ? (
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-1 gap-6 pb-12">
                  {results.map((row: any, i: number) => (
                    <div
                      key={row.storycode || i}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                    >
                      <StoryResultCard row={row} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center bg-surface-2/40 dark:bg-surface-2/20 rounded-3xl border-2 border-dashed border-border p-12 transition-all hover:bg-surface-2/60 hover:border-blue-200 dark:hover:border-blue-800 group shadow-inner">
                <div className="relative mb-8 transform transition-transform group-hover:scale-110 duration-700">
                  <Search className="w-20 h-20 text-text-secondary stroke-[1px]" />
                </div>
                <h3 className="text-foreground font-semibold text-xl mb-4">
                  {t('search.no_results_title')}
                </h3>
                <p className="text-muted-foreground max-w-[340px] leading-relaxed text-sm">
                  {t('search.no_results_desc')}
                </p>
              </div>
            )}
          </div>

          {/* Functional Pagination Section */}
          {totalCount > (parseInt(filters.rowsperpage) || 100) && (
            <div className="px-4 py-6 flex items-center justify-between shrink-0 bg-surface border-t border-border-subtle">
              <div className="text-sm font-medium text-muted-foreground">
                Page <span className="text-foreground">{filters.page}</span> <span className="mx-1 text-text-secondary">/</span> {Math.ceil(totalCount / (parseInt(filters.rowsperpage) || 100))}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={filters.page === 1 || loading}
                  onClick={() => {
                    const newPage = Math.max(1, filters.page - 1);
                    const nextF = { ...filters, page: newPage };
                    setFilters(nextF);
                    handleSearch(undefined, nextF);
                  }}
                  className="h-10 px-5 rounded-2xl border-border-subtle font-bold text-xs"
                >
                  {t('search.previous')}
                </Button>
                <Button
                  variant="outline"
                  disabled={filters.page >= Math.ceil(totalCount / (parseInt(filters.rowsperpage) || 100)) || loading}
                  onClick={() => {
                    const pageSize = (parseInt(filters.rowsperpage) || 100);
                    const maxPage = Math.ceil(totalCount / pageSize);
                    const newPage = Math.min(maxPage, filters.page + 1);
                    const nextF = { ...filters, page: newPage };
                    setFilters(nextF);
                    handleSearch(undefined, nextF);
                  }}
                  className="h-10 px-5 rounded-2xl border-border-subtle font-bold text-xs"
                >
                  {t('search.next')}
                </Button>
              </div>
            </div>
          )}
      </div>
        </div>
      <CollectionManagerDialog 
        open={collectionDialogOpen} 
        onOpenChange={setCollectionDialogOpen} 
      />
    </div>
  )
}


