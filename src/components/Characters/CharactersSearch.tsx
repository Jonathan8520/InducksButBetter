import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronLeft, Cat, Eye, Star, Hash, SlidersHorizontal, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { executeQuery } from "@/lib/db";
import CharacterDetail from "./CharacterDetail";
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect";
import { useMetadata } from "@/hooks/useMetadata";
import { SearchResults } from "@/components/Search/SearchResults";

interface Character {
  charactercode: string;
  charactername: string;
  official?: string;
  onetime?: string;
  heroonly?: string;
  appearances?: number;
  imageUrl?: string;
}

interface CharactersSearchFilters {
  characterName: string;
  characterCode: string;
  heroOnly: boolean;
  oneTime: boolean;
  official: boolean;
  minAppearances: string;
  universes: string[];
  sort: string;
  page: number;
  rowsperpage: string;
}

const initialFilters: CharactersSearchFilters = {
  characterName: "",
  characterCode: "",
  heroOnly: false,
  oneTime: false,
  official: false,
  minAppearances: "",
  universes: [],
  sort: "appearances_desc",
  page: 1,
  rowsperpage: "24",
};

interface CharactersSearchProps {
  selectedCharactercode?: string | null;
  setSelectedCharactercode?: (code: string | null) => void;
}

export function CharactersSearch({ selectedCharactercode, setSelectedCharactercode }: CharactersSearchProps) {
  const { t, i18n } = useTranslation();
  const { meta } = useMetadata();
  const [filters, setFilters] = useState<CharactersSearchFilters>(initialFilters);
  const [results, setResults] = useState<Character[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastFilters, setLastFilters] = useState<CharactersSearchFilters | null>(null);

  const buildCharactersSearchQuery = (searchFilters: CharactersSearchFilters) => {
    const where = ["1=1"];
    const params: any[] = [];

    if (searchFilters.characterName.trim()) {
      const likeVal = `%${searchFilters.characterName.trim()}%`;
      where.push(`(c.charactername LIKE ? OR EXISTS (
        SELECT 1 FROM inducks_characteralias ca 
        WHERE ca.charactercode = c.charactercode AND ca.charactername LIKE ?
      ) OR EXISTS (
        SELECT 1 FROM inducks_charactername cn 
        WHERE cn.charactercode = c.charactercode AND cn.charactername LIKE ?
      ))`);
      params.push(likeVal, likeVal, likeVal);
    }

    if (searchFilters.characterCode.trim()) {
      where.push("c.charactercode LIKE ?");
      params.push(`%${searchFilters.characterCode.trim()}%`);
    }

    if (searchFilters.heroOnly) {
      where.push("c.heroonly = 'Y'");
    }
    if (searchFilters.oneTime) {
      where.push("c.onetime = 'Y'");
    }
    if (searchFilters.official) {
      where.push("c.official = 'Y'");
    }

    if (searchFilters.minAppearances.trim()) {
      where.push(`(SELECT COUNT(*) FROM inducks_appearance WHERE charactercode = c.charactercode) >= ?`);
      params.push(parseInt(searchFilters.minAppearances.trim(), 10));
    }

    if (searchFilters.universes && searchFilters.universes.length > 0) {
      where.push(`EXISTS (SELECT 1 FROM inducks_ucrelation ucr WHERE ucr.charactercode = c.charactercode AND ucr.universecode IN (${searchFilters.universes.map(() => "?").join(",")}))`);
      params.push(...searchFilters.universes);
    }

    const whereClause = "WHERE " + where.join(" AND ");

    let orderBy = "appearances DESC, c.charactername ASC";
    if (searchFilters.sort === "appearances_asc") {
      orderBy = "appearances ASC, c.charactername ASC";
    } else if (searchFilters.sort === "name_asc") {
      orderBy = "c.charactername ASC";
    } else if (searchFilters.sort === "name_desc") {
      orderBy = "c.charactername DESC";
    }

    const limit = parseInt(searchFilters.rowsperpage, 10) || 24;
    const offset = ((searchFilters.page || 1) - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM inducks_character c
      ${whereClause}
    `;

    const mainQuery = `
      SELECT c.charactercode, c.charactername, c.official, c.onetime, c.heroonly,
             (SELECT COUNT(*) FROM inducks_appearance WHERE charactercode = c.charactercode) as appearances,
             (SELECT cu.sitecode || '|' || cu.url 
              FROM inducks_characterurl cu 
              WHERE cu.charactercode = c.charactercode 
              ORDER BY CASE WHEN cu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as imageUrl
      FROM inducks_character c
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

  const performSearch = async (searchFilters: CharactersSearchFilters) => {
    setLoading(true);
    try {
      const { query, countQuery, params, countParams } = buildCharactersSearchQuery(searchFilters);
      
      setResults([]);
      
      const countResult = await executeQuery({ sql: countQuery, args: countParams });
      setTotalCount(Number(countResult.rows[0]?.total || countResult.rows[0]?.COUNT || 0));

      const mainResult = await executeQuery({ sql: query, args: params });
      setResults(mainResult.rows as Character[]);
    } catch (err) {
      console.error(err);
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent | null, overrideFilters?: CharactersSearchFilters) => {
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
    { value: "appearances_desc", labelKey: "sort.appearances_desc" },
    { value: "appearances_asc", labelKey: "sort.appearances_asc" },
    { value: "name_asc", labelKey: "sort.name_asc" },
    { value: "name_desc", labelKey: "sort.name_desc" },
  ];

  if (selectedCharactercode) {
    return (
      <div className="flex-1 flex flex-col border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface h-full">
        <div className="px-8 py-5 border-b border-border-subtle bg-surface flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedCharactercode?.(null)}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-sm font-semibold text-foreground">
            {t("characters.detail_title") || "Détails du personnage"}
          </h2>
        </div>
        <ScrollArea className="flex-1 h-full">
          <CharacterDetail charactercode={selectedCharactercode} />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto lg:overflow-hidden bg-background">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 lg:p-8 gap-8 px-4 lg:px-12">
        {/* Left Side: Filters form */}
        <div className="flex-1 flex flex-col border border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface min-h-[600px] lg:min-h-0">
          <div className="px-6 py-4 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              {t("characters.title") || "Recherche Personnages"}
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <form onSubmit={(e) => handleSearch(e)} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-7">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("characters.name") || "Nom"}</Label>
                <Input
                  placeholder={t("characters.name_placeholder") || "Ex: Mickey, Donald..."}
                  value={filters.characterName}
                  onChange={(e) => setFilters({ ...filters, characterName: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("characters.code") || "Code personnage"}</Label>
                <Input
                  placeholder="Ex: Mickey"
                  value={filters.characterCode}
                  onChange={(e) => setFilters({ ...filters, characterCode: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("characters.min_appearances") || "Apparitions minimum"}</Label>
                <Input
                  type="number"
                  placeholder="Ex: 5"
                  value={filters.minAppearances}
                  onChange={(e) => setFilters({ ...filters, minAppearances: e.target.value })}
                  className="h-10 rounded-xl bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("search.universe") || "Univers"}</Label>
                <SearchableMultiSelect
                  options={meta.universes.map((u: any) => ({
                    value: u.universecode,
                    label: u.universename,
                  }))}
                  selected={filters.universes}
                  onChange={(vals) => setFilters({ ...filters, universes: vals })}
                  placeholder={t("search.all_universes") || "Tous les univers"}
                  searchPlaceholder={t("search.search_universe") || "Rechercher..."}
                  emptyMessage={t("common.no_data") || "Aucun résultat"}
                />
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="heroOnly"
                    checked={filters.heroOnly}
                    onCheckedChange={(checked) => setFilters({ ...filters, heroOnly: checked === true })}
                  />
                  <Label htmlFor="heroOnly" className="text-xs font-medium cursor-pointer">
                    {t("characters.hero_only") || "Héros uniquement"}
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="official"
                    checked={filters.official}
                    onCheckedChange={(checked) => setFilters({ ...filters, official: checked === true })}
                  />
                  <Label htmlFor="official" className="text-xs font-medium cursor-pointer">
                    {t("characters.official") || "Personnage officiel"}
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="oneTime"
                    checked={filters.oneTime}
                    onCheckedChange={(checked) => setFilters({ ...filters, oneTime: checked === true })}
                  />
                  <Label htmlFor="oneTime" className="text-xs font-medium cursor-pointer">
                    {t("characters.onetime") || "Apparition unique"}
                  </Label>
                </div>
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
              {t("characters.reset") || "Réinitialiser"}
            </Button>
            <Button
              onClick={() => handleSearch()}
              disabled={loading}
              className="flex-[1.5] rounded-xl h-11"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("characters.submit") || "Rechercher"}
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
          renderResultCard={(char) => {
            const hasThumb = char.imageUrl && char.imageUrl.includes("|");
            const thumbUrl = hasThumb
              ? `/api/proxy-image?url=${encodeURIComponent(char.imageUrl!.split("|")[1])}`
              : null;

            return (
              <Card
                key={char.charactercode}
                className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/25 hover:shadow-md transition-all duration-300 group flex items-start gap-4 border border-border-subtle bg-surface-2/20 rounded-2xl h-[120px] overflow-hidden"
                onClick={() => setSelectedCharactercode?.(char.charactercode)}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={char.charactername}
                    className="w-16 h-16 rounded-xl object-cover border border-border-subtle shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-surface-3 flex items-center justify-center border border-border-subtle shrink-0">
                    <Cat className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                        {char.charactername}
                      </h3>
                      {char.heroonly === "Y" && (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{char.charactercode}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle/30">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {char.official === "Y" && (
                        <Badge variant="secondary" className="px-1 py-0 text-[8px] h-3.5 bg-primary/20 text-primary border-none">OFFICIEL</Badge>
                      )}
                      {char.onetime === "Y" && (
                        <Badge variant="secondary" className="px-1 py-0 text-[8px] h-3.5 bg-muted-foreground/20 text-muted-foreground border-none">1 FOIS</Badge>
                      )}
                    </span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                      {char.appearances || 0}
                    </span>
                  </div>
                </div>
              </Card>
            );
          }}
          renderSkeleton={(i) => (
            <div key={i} className="h-[120px] rounded-2xl border border-border-subtle bg-surface-2/20 animate-shimmer" />
          )}
          foundLabel={t("characters.characters_found", { count: totalCount, defaultValue: `${totalCount} personnages trouvés` })}
          onSelect={(code) => setSelectedCharactercode?.(code)}
        />
      </div>
    </div>
  );
}

export default CharactersSearch;
