import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronLeft, Calendar, MapPin, User, FileText, Settings, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect";
import { useMetadata } from "@/hooks/useMetadata";
import { COUNTRY_CONTINENTS } from "@/lib/types";
import { executeQuery } from "@/lib/db";
import AuthorDetail from "./AuthorDetail";
import { getFlagUrl } from "@/lib/utils";
import { Autocomplete } from "@/components/Autocomplete";
import { autocompletePerson } from "@/lib/turso";
import { SearchResults } from "@/components/Search/SearchResults";

interface Author {
  personcode: string;
  fullname: string;
  nationalitycountrycode?: string;
  numberofindexedissues?: number;
  borndate?: string;
  deceaseddate?: string;
}

interface AuthorsSearchFilters {
  fullName: string;
  nationality: string[];
  bornAfter: string;
  bornBefore: string;
  deceasedAfter: string;
  deceasedBefore: string;
  birthPlace: string;
  deceasedPlace: string;
  minStories: string;
  mainRole: string;
  sort: string;
  page: number;
  rowsperpage: string;
}

const initialFilters: AuthorsSearchFilters = {
  fullName: "",
  nationality: [],
  bornAfter: "",
  bornBefore: "",
  deceasedAfter: "",
  deceasedBefore: "",
  birthPlace: "",
  deceasedPlace: "",
  minStories: "",
  mainRole: "any",
  sort: "stories_desc",
  page: 1,
  rowsperpage: "24",
};

interface AuthorsSearchProps {
  selectedAuthorcode?: string | null;
  setSelectedAuthorcode?: (code: string | null) => void;
}

export function AuthorsSearch({ selectedAuthorcode, setSelectedAuthorcode }: AuthorsSearchProps) {
  const { t } = useTranslation();
  const { meta } = useMetadata();
  const [filters, setFilters] = useState<AuthorsSearchFilters>(initialFilters);

  const [results, setResults] = useState<Author[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastFilters, setLastFilters] = useState<AuthorsSearchFilters | null>(null);

  const buildAuthorsSearchQuery = (searchFilters: AuthorsSearchFilters) => {
    const where = ["1=1"];
    const params: any[] = [];

    if (searchFilters.fullName.trim()) {
      const likeVal = `%${searchFilters.fullName.trim()}%`;
      where.push(`(p.fullname LIKE ? OR p.personcode LIKE ? OR EXISTS (
        SELECT 1 FROM inducks_personalias pa 
        WHERE pa.personcode = p.personcode AND (pa.surname LIKE ? OR pa.givenname LIKE ?)
      ))`);
      params.push(likeVal, likeVal, likeVal, likeVal);
    }

    if (searchFilters.nationality && searchFilters.nationality.length > 0) {
      where.push(`p.nationalitycountrycode IN (${searchFilters.nationality.map(() => "?").join(",")})`);
      params.push(...searchFilters.nationality);
    }

    if (searchFilters.bornAfter.trim()) {
      where.push("SUBSTR(p.borndate, 1, 4) >= ?");
      params.push(searchFilters.bornAfter.trim());
    }
    if (searchFilters.bornBefore.trim()) {
      where.push("SUBSTR(p.borndate, 1, 4) <= ?");
      params.push(searchFilters.bornBefore.trim());
    }

    if (searchFilters.deceasedAfter.trim()) {
      where.push("SUBSTR(p.deceaseddate, 1, 4) >= ?");
      params.push(searchFilters.deceasedAfter.trim());
    }
    if (searchFilters.deceasedBefore.trim()) {
      where.push("SUBSTR(p.deceaseddate, 1, 4) <= ?");
      params.push(searchFilters.deceasedBefore.trim());
    }

    if (searchFilters.birthPlace.trim()) {
      where.push("p.bornplace LIKE ?");
      params.push(`%${searchFilters.birthPlace.trim()}%`);
    }
    if (searchFilters.deceasedPlace.trim()) {
      where.push("p.deceasedplace LIKE ?");
      params.push(`%${searchFilters.deceasedPlace.trim()}%`);
    }

    if (searchFilters.minStories.trim()) {
      where.push("CAST(p.numberofindexedissues AS INTEGER) >= ?");
      params.push(parseInt(searchFilters.minStories.trim(), 10));
    }

    if (searchFilters.mainRole && searchFilters.mainRole !== "any") {
      where.push(`EXISTS (
        SELECT 1 FROM inducks_storyjob sj 
        WHERE sj.personcode = p.personcode AND sj.plotwritartink = ?
      )`);
      params.push(searchFilters.mainRole);
    }

    const whereClause = "WHERE " + where.join(" AND ");
    
    let orderBy = "CAST(p.numberofindexedissues AS INTEGER) DESC, p.fullname ASC";
    if (searchFilters.sort === "stories_asc") {
      orderBy = "CAST(p.numberofindexedissues AS INTEGER) ASC, p.fullname ASC";
    } else if (searchFilters.sort === "name_asc") {
      orderBy = "p.fullname ASC";
    } else if (searchFilters.sort === "name_desc") {
      orderBy = "p.fullname DESC";
    }

    const limit = parseInt(searchFilters.rowsperpage, 10) || 24;
    const offset = ((searchFilters.page || 1) - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM inducks_person p
      ${whereClause}
    `;

    const mainQuery = `
      SELECT p.personcode, p.fullname, p.nationalitycountrycode, p.numberofindexedissues, p.borndate, p.deceaseddate
      FROM inducks_person p
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    return {
      query: mainQuery,
      countQuery,
      params: [...params, limit, offset],
      countParams: params,
    };
  };

  const performSearch = async (searchFilters: AuthorsSearchFilters) => {
    setLoading(true);
    try {
      const { query, countQuery, params, countParams } = buildAuthorsSearchQuery(searchFilters);
      
      setResults([]);
      
      const countResult = await executeQuery({ sql: countQuery, args: countParams });
      setTotalCount(Number(countResult.rows[0]?.total || countResult.rows[0]?.COUNT || 0));

      const mainResult = await executeQuery({ sql: query, args: params });
      setResults(mainResult.rows as Author[]);
    } catch (err) {
      console.error(err);
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent | null, overrideFilters?: AuthorsSearchFilters) => {
    if (e) e.preventDefault();
    const currentFilters = overrideFilters || filters;
    setLastFilters(currentFilters);
    await performSearch(currentFilters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setResults([]);
    setTotalCount(0);
    setLastFilters(null);
  };

  const sortOptions = [
    { value: "stories_desc", labelKey: "sort.stories_desc" },
    { value: "stories_asc", labelKey: "sort.stories_asc" },
    { value: "name_asc", labelKey: "sort.name_asc" },
    { value: "name_desc", labelKey: "sort.name_desc" },
  ];

  if (selectedAuthorcode) {
    return (
      <div className="flex-1 flex flex-col border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface h-full">
        <div className="px-8 py-5 border-b border-border-subtle bg-surface flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedAuthorcode?.(null)}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-sm font-semibold text-foreground">
            {t("authors.detail_title")}
          </h2>
        </div>
        <ScrollArea className="flex-1 h-full">
          <AuthorDetail personcode={selectedAuthorcode} />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto lg:overflow-hidden bg-background">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 lg:p-8 gap-8 px-4 lg:px-12">
        {/* Left Side: Search Form Card */}
        <div className="flex-1 flex flex-col border border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface min-h-[600px] lg:min-h-0">
          <div className="px-6 py-4 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              {t("authors.title")}
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <form onSubmit={(e) => handleSearch(e)} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-7">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("authors.full_name")}</Label>
                <Autocomplete
                  value={filters.fullName}
                  placeholder={t("authors.full_name_placeholder") || "Ex: Don Rosa..."}
                  emptyMessage={t("common.no_data") || "Aucun résultat"}
                  fetchOptions={autocompletePerson}
                  onInputChange={(val) => setFilters({ ...filters, fullName: val })}
                  onSelect={(id, name) => setFilters({ ...filters, fullName: name })}
                  onClear={() => setFilters({ ...filters, fullName: "" })}
                  type="authors"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("authors.nationality")}</Label>
                <SearchableMultiSelect
                  options={meta.countries.map((c: any) => ({
                    value: c.countrycode,
                    label: t(`nationalities.${c.countrycode.toLowerCase()}`) !== `nationalities.${c.countrycode.toLowerCase()}` ? t(`nationalities.${c.countrycode.toLowerCase()}`) : c.countryname,
                    group: t(`continents.${COUNTRY_CONTINENTS[c.countrycode.toLowerCase()] || "other"}`),
                    icon: (
                      <img
                        src={getFlagUrl(c.countrycode)}
                        className="w-4 h-3 rounded-xs"
                        alt=""
                      />
                    ),
                  }))}
                  selected={filters.nationality}
                  onChange={(vals) => setFilters({ ...filters, nationality: vals })}
                  placeholder={t("nationalities.any") || "Toutes nationalités"}
                  searchPlaceholder={t("search.search_country") || "Rechercher..."}
                  emptyMessage={t("common.no_data") || "Aucun résultat"}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("authors.main_role") || "Rôle principal"}</Label>
                <Select
                  value={filters.mainRole}
                  onValueChange={(val) => setFilters({ ...filters, mainRole: val })}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border-subtle bg-surface">
                    <SelectItem value="any" className="rounded-lg">{t("authors.role_any") || "Tous les rôles"}</SelectItem>
                    <SelectItem value="w" className="rounded-lg">{t("authors.role_writer") || "Scénariste"}</SelectItem>
                    <SelectItem value="a" className="rounded-lg">{t("authors.role_artist") || "Dessinateur"}</SelectItem>
                    <SelectItem value="i" className="rounded-lg">{t("roles.i") || "Encreur"}</SelectItem>
                    <SelectItem value="p" className="rounded-lg">{t("roles.p") || "Scénario (plot)"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("authors.born_range") || "Année naiss. min"}</Label>
                <Input
                  placeholder="Ex: 1900"
                  value={filters.bornAfter}
                  onChange={(e) => setFilters({ ...filters, bornAfter: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{"Max"}</Label>
                <Input
                  placeholder="Ex: 1950"
                  value={filters.bornBefore}
                  onChange={(e) => setFilters({ ...filters, bornBefore: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("authors.deceased_range") || "Année décès min"}</Label>
                <Input
                  placeholder="Ex: 1980"
                  value={filters.deceasedAfter}
                  onChange={(e) => setFilters({ ...filters, deceasedAfter: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{"Max"}</Label>
                <Input
                  placeholder="Ex: 2020"
                  value={filters.deceasedBefore}
                  onChange={(e) => setFilters({ ...filters, deceasedBefore: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("authors.born_place") || "Lieu de naissance"}</Label>
                <Input
                  placeholder="Ex: Oregon"
                  value={filters.birthPlace}
                  onChange={(e) => setFilters({ ...filters, birthPlace: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("authors.deceased_place") || "Lieu de décès"}</Label>
                <Input
                  placeholder="Ex: California"
                  value={filters.deceasedPlace}
                  onChange={(e) => setFilters({ ...filters, deceasedPlace: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("authors.min_stories") || "Histoires minimum"}</Label>
                <Input
                  type="number"
                  placeholder="Ex: 10"
                  value={filters.minStories}
                  onChange={(e) => setFilters({ ...filters, minStories: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>
            </form>
          </ScrollArea>

          <div className="p-6 border-t border-border-subtle bg-surface-2/30 flex gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1 rounded-xl h-11"
            >
              {t("authors.reset")}
            </Button>
            <Button
              onClick={() => handleSearch()}
              disabled={loading}
              className="flex-[1.5] rounded-xl h-11"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("authors.submit")}
            </Button>
          </div>
        </div>

        {/* Right Side: Reusable SearchResults */}
        <SearchResults
          results={results}
          totalCount={totalCount}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          handleSearch={handleSearch}
          isInitialState={lastFilters === null}
          sortOptions={sortOptions}
          renderResultCard={(author) => {
            const flagUrl = author.nationalitycountrycode ? getFlagUrl(author.nationalitycountrycode) : null;
            return (
              <Card
                key={author.personcode}
                className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/25 hover:shadow-md transition-all duration-300 group flex flex-col justify-between h-[130px] border border-border-subtle bg-surface-2/20 rounded-2xl"
                onClick={() => setSelectedAuthorcode?.(author.personcode)}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                      {author.fullname}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{author.personcode}</p>
                  </div>
                  {flagUrl && (
                    <img
                      src={flagUrl}
                      alt={author.nationalitycountrycode}
                      className="w-5 h-3.5 rounded object-cover shadow-sm shrink-0 border border-border-subtle/10"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/40 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {author.borndate ? author.borndate.substring(0, 4) : "?"}
                      {" — "}
                      {author.deceaseddate ? author.deceaseddate.substring(0, 4) : author.borndate ? "Présent" : "?"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-foreground">
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{author.numberofindexedissues || 0}</span>
                  </div>
                </div>
              </Card>
            );
          }}
          renderSkeleton={(i) => (
            <div key={i} className="h-[130px] rounded-2xl border border-border-subtle bg-surface-2/20 animate-shimmer" />
          )}
          foundLabel={t("authors.authors_found", { count: totalCount, defaultValue: `${totalCount} auteurs trouvés` })}
          onSelect={(code) => setSelectedAuthorcode?.(code)}
        />
      </div>
    </div>
  );
}

export default AuthorsSearch;
