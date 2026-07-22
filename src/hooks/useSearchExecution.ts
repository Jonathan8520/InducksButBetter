import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { executeQuery } from "@/lib/db";
import { buildAdvancedSearchQuery, SearchFilters } from "@/lib/searchService";

interface UseSearchExecutionProps {
  filters: SearchFilters;
  pagesSliderMoved: boolean;
}

export function useSearchExecution({ filters, pagesSliderMoved }: UseSearchExecutionProps) {
  const { t, i18n } = useTranslation();
  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastSearchFilters, setLastSearchFilters] = useState<SearchFilters | null>(null);

  const performSearch = async (searchFilters: SearchFilters) => {
    setLoading(true);
    try {
      const filtersForQuery = {
        ...searchFilters,
        charactercode: Array.isArray(searchFilters.charactercode)
          ? searchFilters.charactercode.join(",")
          : searchFilters.charactercode,
        herocode: Array.isArray(searchFilters.herocode)
          ? searchFilters.herocode.join(",")
          : searchFilters.herocode,
        excludeCharactercode: Array.isArray(searchFilters.excludeCharactercode)
          ? searchFilters.excludeCharactercode.join(",")
          : searchFilters.excludeCharactercode,
        personRoles: searchFilters.personRoles?.filter((pr: any) => pr.code !== ""),
        excludePersoncode: Array.isArray(searchFilters.excludePersoncode)
          ? searchFilters.excludePersoncode.filter(Boolean)
          : searchFilters.excludePersoncode ? [searchFilters.excludePersoncode].filter(Boolean) : [],
        nationality: Array.isArray(searchFilters.nationality)
          ? searchFilters.nationality.join(",")
          : searchFilters.nationality,
        universes: Array.isArray(searchFilters.universes)
          ? searchFilters.universes.join(",")
          : searchFilters.universes,
        subseriescode: Array.isArray(searchFilters.subseriescode)
          ? searchFilters.subseriescode.join(",")
          : searchFilters.subseriescode,
        lang: i18n.language,
        noOtherCharacters: searchFilters.noOtherCharacters,
        country: Array.isArray(searchFilters.country)
          ? searchFilters.country.join(",")
          : searchFilters.country,
        language: Array.isArray(searchFilters.language)
          ? searchFilters.language.join(",")
          : searchFilters.language,
        kind: Array.isArray(searchFilters.kind)
          ? searchFilters.kind.join(",")
          : searchFilters.kind,
        pagesMax: pagesSliderMoved ? searchFilters.pagesMax : undefined,
      };

      const { query, countQuery, params, countParams } = buildAdvancedSearchQuery(filtersForQuery);

      setResults([]);

      // Les résultats partent en premier et sans attendre le décompte. Auparavant, le
      // COUNT(*) était awaité AVANT la requête paginée : deux parcours complets de la
      // même clause WHERE, en série, avant le premier résultat affiché. C'est ce qui
      // doublait le coût de chaque recherche.
      const rowsPromise = executeQuery({ sql: query, args: params }, (newRow) => {
        setResults((prev) => [...prev, newRow]);
      });

      // Le décompte n'est utile qu'à la pagination : on le laisse arriver en parallèle et
      // son échec éventuel ne doit pas priver l'utilisateur de ses résultats.
      const countPromise = executeQuery({ sql: countQuery, args: countParams })
        .then((r) => Number(r.rows[0]?.total || r.rows[0]?.COUNT || 0))
        .catch(() => -1);

      await rowsPromise;
      const total = await countPromise;
      if (total >= 0) setTotalCount(total);
    } catch (err) {
      console.error(err);
      toast.error(t("search.error_fetch", { defaultValue: "Erreur: impossible de récupérer les données." }));
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lastSearchFilters) {
      performSearch(lastSearchFilters);
    }
  }, [i18n.language]);

  const handleSearch = async (e?: React.FormEvent | null, overrideFilters?: SearchFilters) => {
    if (e) e.preventDefault();
    const currentFilters = overrideFilters || filters;
    setLastSearchFilters(currentFilters);
    await performSearch(currentFilters);
  };

  return {
    results,
    setResults,
    totalCount,
    setTotalCount,
    loading,
    lastSearchFilters,
    setLastSearchFilters,
    performSearch,
    handleSearch,
  };
}
