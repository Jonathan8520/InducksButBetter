import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Settings, X } from "lucide-react";
import { parseISO, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Autocomplete } from "@/components/Autocomplete";
import { MultiAutocomplete } from "@/components/MultiAutocomplete";
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { SearchFilters } from "@/lib/searchService";
import { initialFilters } from "@/hooks/useSearchFilters";
import { MetaData, COUNTRY_CONTINENTS } from "@/lib/types";
import { AUTHOR_NATIONALITIES, KIND_LABELS } from "@/lib/constants";
import { autocompleteStorycode, autocompletePublisher, autocompletePerson, autocompleteCharacter } from "@/lib/turso";

interface SearchFormProps {
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  pagesSliderMoved: boolean;
  setPagesSliderMoved: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLabels: Record<string, string>;
  setSelectedLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  cookieValue: string;
  setCookieValue: (value: string) => void;
  isSavingCookie: boolean;
  saveCookie: () => Promise<void>;
  addSelection: (key: "charactercode" | "herocode" | "excludeCharactercode", value: string, label: string) => void;
  removeSelection: (key: "charactercode" | "herocode" | "excludeCharactercode", value: string) => void;
  handleClearFilters: () => void;
  handleSearch: (e?: React.FormEvent | null, overrideFilters?: SearchFilters) => Promise<void>;
  loading: boolean;
  meta: MetaData;
  setResults: React.Dispatch<React.SetStateAction<any[]>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  collectionDialogOpen: boolean;
  setCollectionDialogOpen: (open: boolean) => void;
}

export function SearchForm({
  filters,
  setFilters,
  pagesSliderMoved,
  setPagesSliderMoved,
  selectedLabels,
  setSelectedLabels,
  isSettingsOpen,
  setIsSettingsOpen,
  cookieValue,
  setCookieValue,
  isSavingCookie,
  saveCookie,
  addSelection,
  removeSelection,
  handleClearFilters,
  handleSearch,
  loading,
  meta,
  setResults,
  setTotalCount,
  collectionDialogOpen,
  setCollectionDialogOpen,
}: SearchFormProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex-1 flex flex-col border-border-subtle/60 dark:border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface min-h-[600px] lg:min-h-0">
      <div className="px-8 py-5 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-3">
          {t("search.title")}
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
                  Ce cookie permet d'accéder aux images haute résolution. Récupérez-le dans l'onglet Application &gt; Cookies de l'inspecteur sur{" "}
                  <a href="https://inducks.org" target="_blank" rel="noreferrer" className="text-blue-500 underline">
                    inducks.org
                  </a>
                  .
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
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-7">
            {/* Row: Code & Keywords */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.inducks_code")}</Label>
              <Autocomplete
                value={filters.storycode}
                placeholder={t("search.inducks_code_placeholder")}
                emptyMessage={t("common.no_data")}
                fetchOptions={(q) => autocompleteStorycode(q, i18n.language)}
                onSelect={(val) => setFilters({ ...filters, storycode: val })}
                onInputChange={(val) => setFilters({ ...filters, storycode: val })}
                onClear={() => setFilters({ ...filters, storycode: "" })}
                type="stories"
                hideSearchIcon={true}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.keywords")}</Label>
              <Input
                variant="search"
                placeholder={t("search.keywords_placeholder")}
                value={filters.title}
                onChange={(e) => setFilters({ ...filters, title: e.target.value })}
              />
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                  <Checkbox
                    id="comments"
                    checked={filters.includeComments === true}
                    onCheckedChange={(checked) => setFilters({ ...filters, includeComments: checked === true })}
                  />
                  <label htmlFor="comments" className="text-xs text-text-secondary cursor-pointer leading-snug">
                    {t("search.include_comments")}
                  </label>
                </div>
                <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                  <Checkbox
                    id="multiple-parts"
                    checked={filters.multipleParts === true}
                    onCheckedChange={(checked) => setFilters({ ...filters, multipleParts: checked === true })}
                  />
                  <label htmlFor="multiple-parts" className="text-xs text-text-secondary cursor-pointer leading-snug">
                    {t("search.multiple_parts")}
                  </label>
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.content_type")}</Label>
                <SearchableMultiSelect
                  options={Object.entries(KIND_LABELS).map(([code, label]) => ({
                    value: code,
                    label: label,
                  }))}
                  selected={(filters.kind || []) as string[]}
                  onChange={(val) => setFilters({ ...filters, kind: val })}
                  placeholder={t("search.all_types")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Affichage</Label>
                <Select
                  value={filters.hasImage || "all"}
                  onValueChange={(val) => setFilters({ ...filters, hasImage: val as any })}
                >
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
              <Label className="text-sm font-medium text-foreground">{t("search.publication_period")}</Label>
              <DateRangePicker
                date={{
                  from: filters.dateAfter ? parseISO(filters.dateAfter) : undefined,
                  to: filters.dateBefore ? parseISO(filters.dateBefore) : undefined,
                }}
                setDate={(range) => {
                  setFilters({
                    ...filters,
                    dateAfter: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                    dateBefore: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                  });
                }}
              />
            </div>

            {/* Row: Publisher & Country */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publisher")}</Label>
              <Autocomplete
                value={filters.publisherid}
                placeholder={t("search.publisher_placeholder")}
                emptyMessage={t("common.no_data")}
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
                  checked={filters.onlyCollection === true}
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
                  {t("search.only_collection")}
                </label>
                <button
                  type="button"
                  onClick={() => setCollectionDialogOpen(true)}
                  className="p-1 text-text-secondary hover:text-text-body transition-colors rounded hover:bg-surface-2"
                  title="Gérer ma collection"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publication_country")}</Label>
              <SearchableMultiSelect
                options={meta.countries.map((c: any) => ({
                  value: c.countrycode,
                  label: c.countryname,
                  group: t(`continents.${COUNTRY_CONTINENTS[c.countrycode.toLowerCase()] || "other"}`),
                  icon: (
                    <img
                      src={`https://flagcdn.com/w20/${c.countrycode.toLowerCase()}.png`}
                      className="w-4 h-3 rounded-xs"
                      alt=""
                    />
                  ),
                }))}
                selected={(filters.country || []) as string[]}
                onChange={(vals) => setFilters({ ...filters, country: vals })}
                placeholder={t("search.any_country")}
                searchPlaceholder={t("search.search_country")}
                emptyMessage={t("common.no_data")}
              />
            </div>

            {/* Row: Language */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publication_language")}</Label>
              <SearchableMultiSelect
                options={meta.languages.map((l: any) => ({
                  value: l.languagecode,
                  label: t(`languages.${l.languagecode}`),
                }))}
                selected={(filters.language || []) as string[]}
                onChange={(vals) => setFilters({ ...filters, language: vals })}
                placeholder={t("search.all_languages")}
                searchPlaceholder={t("search.search_language")}
                emptyMessage={t("common.no_data")}
              />
            </div>

            <div className="col-span-1 md:col-span-2 space-y-3 pt-2">
              <Label className="text-sm font-medium text-foreground">{t("search.authors")}</Label>
              <div className="flex flex-col gap-3">
                {filters.personRoles?.map((pr, idx) => (
                  <div key={pr.id} className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="flex-1 w-full relative">
                      {pr.code ? (
                        <div className="h-10 border border-border-subtle rounded-xl bg-surface-2 flex items-center justify-between px-3">
                          <span className="text-sm font-medium">{selectedLabels[pr.code] || pr.code}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full"
                            onClick={() => {
                              const newRoles = [...filters.personRoles!];
                              newRoles[idx].code = "";
                              setFilters({ ...filters, personRoles: newRoles });
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Autocomplete
                          value={pr.code}
                          placeholder={t("search.author_placeholder")}
                          emptyMessage={t("common.no_data")}
                          fetchOptions={autocompletePerson}
                          onSelect={(val, label) => {
                            const newRoles = [...filters.personRoles!];
                            newRoles[idx].code = val;
                            setFilters({ ...filters, personRoles: newRoles });
                            setSelectedLabels({ ...selectedLabels, [val]: label });
                          }}
                          type="authors"
                        />
                      )}
                    </div>
                    <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <Select
                        value={pr.role}
                        onValueChange={(val) => {
                          const newRoles = [...filters.personRoles!];
                          newRoles[idx].role = val;
                          setFilters({ ...filters, personRoles: newRoles });
                        }}
                      >
                        <SelectTrigger className="flex-1 sm:w-[140px] h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                          <SelectValue placeholder={t("search.role")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">{t("roles.any")}</SelectItem>
                          <SelectItem value="p">{t("roles.p")}</SelectItem>
                          <SelectItem value="w">{t("roles.w")}</SelectItem>
                          <SelectItem value="a">{t("roles.a")}</SelectItem>
                          <SelectItem value="i">{t("roles.i")}</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {filters.personRoles!.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-text-secondary hover:text-red-500 shrink-0"
                            onClick={() => {
                              setFilters({
                                ...filters,
                                personRoles: filters.personRoles!.filter((_, i) => i !== idx),
                              });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {idx === filters.personRoles!.length - 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl shrink-0"
                            onClick={() => {
                              setFilters({
                                ...filters,
                                personRoles: [
                                  ...filters.personRoles!,
                                  { id: Date.now().toString(), code: "", role: "any" },
                                ],
                              });
                            }}
                          >
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
              <Label className="text-sm font-medium text-foreground">{t("search.not_author")}</Label>
              <Autocomplete
                value={filters.excludePersoncode?.[0] || ""}
                placeholder={t("search.exclude_author_placeholder")}
                emptyMessage={t("common.no_data")}
                fetchOptions={autocompletePerson}
                onSelect={(val) => setFilters({ ...filters, excludePersoncode: [val] })}
                onClear={() => setFilters({ ...filters, excludePersoncode: [] })}
                hideIcon={true}
                hideSearchIcon={true}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.author_nationality")}</Label>
              <SearchableMultiSelect
                options={AUTHOR_NATIONALITIES.filter((n) => n.code !== "any").map((n) => ({
                  value: n.code,
                  label: t(`nationalities.${n.code}`),
                  group: t(`continents.${COUNTRY_CONTINENTS[n.code] || "other"}`),
                  icon: (
                    <img
                      src={`https://flagcdn.com/w20/${n.code === "uk" ? "gb" : n.code}.png`}
                      className="w-4 h-3 rounded-xs object-cover"
                      alt=""
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ),
                }))}
                selected={Array.isArray(filters.nationality) ? filters.nationality : []}
                onChange={(vals) => setFilters({ ...filters, nationality: vals })}
                placeholder={t("search.any_country")}
                searchPlaceholder={t("search.search_country")}
                emptyMessage={t("common.no_data")}
              />
            </div>

            {/* Characters & Universe Row */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pt-4 border-t border-border-subtle">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.heroes")}</Label>
                <MultiAutocomplete
                  placeholder={t("search.heroes_placeholder")}
                  emptyMessage={t("common.no_data")}
                  fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                  selected={(filters.herocode || []) as string[]}
                  selectedLabels={selectedLabels}
                  onSelect={(val, label) => addSelection("herocode", val, label)}
                  onRemove={(val) => removeSelection("herocode", val)}
                  onClear={() => setFilters({ ...filters, herocode: [] })}
                  type="characters"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.universe")}</Label>
                <SearchableMultiSelect
                  options={meta.universes.map((u) => ({
                    value: u.universecode,
                    label: u.universename,
                  }))}
                  selected={Array.isArray(filters.universes) ? filters.universes : []}
                  onChange={(vals) => setFilters({ ...filters, universes: vals })}
                  placeholder={t("search.all_universes")}
                  searchPlaceholder={t("search.search_universe")}
                  emptyMessage={t("common.no_data")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.series")}</Label>
                <SearchableMultiSelect
                  options={meta.subseries || []}
                  selected={(filters.subseriescode || []) as string[]}
                  onChange={(vals) => setFilters({ ...filters, subseriescode: vals })}
                  placeholder={t("search.all_series")}
                  searchPlaceholder={t("search.search_series")}
                  emptyMessage={t("common.no_data")}
                />
              </div>
            </div>

            {/* Character Presence Details */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.characters")}</Label>
                <MultiAutocomplete
                  placeholder={t("search.search_character_placeholder")}
                  emptyMessage={t("common.no_data")}
                  fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                  selected={(filters.charactercode || []) as string[]}
                  selectedLabels={selectedLabels}
                  onSelect={(val, label) => addSelection("charactercode", val, label)}
                  onRemove={(val) => removeSelection("charactercode", val)}
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
                      {t("search.no_other_characters")}
                    </label>
                  </div>
                  <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                    <Checkbox
                      id="incomplete-indexing"
                      checked={filters.indexingIncomplete === true}
                      onCheckedChange={(checked) => setFilters({ ...filters, indexingIncomplete: checked === true })}
                    />
                    <label htmlFor="incomplete-indexing" className="text-xs text-text-secondary cursor-pointer">
                      {t("search.indexing_incomplete")}
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground text-red-600">
                  {t("search.exclude_character")}
                </Label>
                <MultiAutocomplete
                  placeholder={t("search.exclude_character_placeholder")}
                  emptyMessage={t("common.no_data")}
                  fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                  selected={(filters.excludeCharactercode || []) as string[]}
                  selectedLabels={selectedLabels}
                  onSelect={(val, label) => addSelection("excludeCharactercode", val, label)}
                  onRemove={(val) => removeSelection("excludeCharactercode", val)}
                  onClear={() => setFilters({ ...filters, excludeCharactercode: [] })}
                  type="characters"
                />
              </div>
            </div>

            {/* Layout Row: Strips per page & Panels per strip */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border-subtle">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.strips_per_page")}</Label>
                <Select
                  value={filters.stripsperpage || "all"}
                  onValueChange={(val) => setFilters({ ...filters, stripsperpage: val })}
                >
                  <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                    <SelectValue placeholder={t("search.any")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">N'importe</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v} {t("search.strips_per_page").toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.panels_per_strip")}</Label>
                <Select
                  value={filters.panelsperstrip || "all"}
                  onValueChange={(val) => setFilters({ ...filters, panelsperstrip: val })}
                >
                  <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                    <SelectValue placeholder={t("search.any")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("search.any")}</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v} vignettes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pages Slider */}
            <div className="col-span-1 md:col-span-2 space-y-3 pt-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">{t("search.pages")}</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      variant="search"
                      placeholder={t("search.pages_exact")}
                      value={filters.pagesExact}
                      onChange={(e) => setFilters({ ...filters, pagesExact: e.target.value })}
                      className="w-24"
                    />
                    <span className="text-[10px] font-medium text-muted-foreground tracking-tight">
                      {t("search.pages_exact")}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono font-medium bg-surface-2 px-2 py-0.5 rounded border border-border-subtle mb-1">
                  {filters.pagesMin} — {filters.pagesMax}
                </span>
              </div>
              <div className="flex items-center gap-4 py-3 pb-8">
                <span className="text-xs font-medium text-muted-foreground w-4">0</span>
                <Slider
                  value={[filters.pagesMin ?? 0, filters.pagesMax ?? 500]}
                  max={500}
                  step={1}
                  className="flex-1"
                  onValueChange={([min, max]) => {
                    setPagesSliderMoved(true);
                    setFilters({ ...filters, pagesMin: min, pagesMax: max });
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
            handleClearFilters();
            setResults([]);
            setTotalCount(0);
          }}
        >
          {t("search.reset")}
        </Button>
        <Button
          className="flex-[1.5] h-12 bg-primary text-primary-foreground font-medium text-sm shadow-xl hover:bg-primary/90 transition-all rounded-2xl active:scale-[0.98]"
          onClick={() => handleSearch()}
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span>{t("search.searching")}</span>
            </div>
          ) : (
            <>{t("search.submit")}</>
          )}
        </Button>
      </div>
    </div>
  );
}
