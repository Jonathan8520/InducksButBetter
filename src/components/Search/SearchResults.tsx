import React from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StoryResultCard } from "@/components/StoryResultCard";
import StoryResultSkeleton from "@/components/StoryResultSkeleton";
import { SearchFilters } from "@/lib/searchService";

interface SearchResultsProps {
  results: any[];
  totalCount: number;
  loading: boolean;
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  handleSearch: (e?: React.FormEvent | null, overrideFilters?: SearchFilters) => Promise<void>;
  isInitialState: boolean;
}

export function SearchResults({
  results,
  totalCount,
  loading,
  filters,
  setFilters,
  handleSearch,
  isInitialState,
}: SearchResultsProps) {
  const { t } = useTranslation();
  const rowsPerPage = parseInt(String(filters.rowsperpage || "24"), 10) || 24;
  const currentPage = parseInt(String(filters.page || "1"), 10) || 1;
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="flex items-center justify-between mb-6 px-2 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold tracking-tight text-text-body">{t("search.results")}</h2>
          {totalCount > 0 && (
            <Select
              value={filters.sort}
              onValueChange={(val) => {
                const newFilters = { ...filters, sort: val, page: 1 };
                setFilters(newFilters);
                handleSearch(null, newFilters);
              }}
            >
              <SelectTrigger className="h-10 border-border-subtle bg-surface/80 rounded-xl hover:bg-surface-2 transition-all font-medium text-sm">
                <SelectValue placeholder={t("search.sort_by")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border-subtle bg-surface">
                <SelectItem value="pubdate_desc" className="rounded-lg">
                  {t("sort.pubdate_desc")}
                </SelectItem>
                <SelectItem value="pubdate_asc" className="rounded-lg">
                  {t("sort.pubdate_asc")}
                </SelectItem>
                <SelectItem value="title_az" className="rounded-lg">
                  {t("sort.title_az")}
                </SelectItem>
                <SelectItem value="title_za" className="rounded-lg">
                  {t("sort.title_za")}
                </SelectItem>
                <SelectItem value="pages_desc" className="rounded-lg">
                  {t("sort.pages_desc")}
                </SelectItem>
                <SelectItem value="pages_asc" className="rounded-lg">
                  {t("sort.pages_asc")}
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {totalCount > 0 && (
          <Badge variant="secondary" className="bg-primary text-primary-foreground border-none px-3 font-bold">
            {t("search.stories_found", { count: totalCount })}
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <ScrollArea className="h-full pr-4">
            <div className="grid grid-cols-1 gap-6 pb-12 opacity-70">
              {[1, 2, 3, 4].map((i) => (
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
        ) : isInitialState ? (
          <div className="flex flex-col items-center justify-center h-full text-center bg-surface-2/40 dark:bg-surface-2/20 rounded-3xl border-2 border-dashed border-border p-12 transition-all hover:bg-surface-2/60 hover:border-blue-200 dark:hover:border-blue-800 group shadow-inner">
            <div className="relative mb-8 transform transition-transform group-hover:scale-110 duration-700">
              <Search className="w-20 h-20 text-text-secondary stroke-[1px]" />
            </div>
            <h3 className="text-foreground font-semibold text-xl mb-4">{t("search.initial_title", { defaultValue: "Prêt à chercher ?" })}</h3>
            <p className="text-muted-foreground max-w-[340px] leading-relaxed text-sm">
              {t("search.initial_desc", { defaultValue: "Remplissez le formulaire à gauche et lancez la recherche pour explorer la base de données Inducks." })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center bg-surface-2/40 dark:bg-surface-2/20 rounded-3xl border-2 border-dashed border-border p-12 transition-all hover:bg-surface-2/60 hover:border-blue-200 dark:hover:border-blue-800 group shadow-inner">
            <div className="relative mb-8 transform transition-transform group-hover:scale-110 duration-700">
              <Search className="w-20 h-20 text-text-secondary stroke-[1px] text-red-500" />
            </div>
            <h3 className="text-foreground font-semibold text-xl mb-4">{t("search.no_results_title")}</h3>
            <p className="text-muted-foreground max-w-[340px] leading-relaxed text-sm">
              {t("search.no_results_desc")}
            </p>
          </div>
        )}
      </div>

      {/* Functional Pagination Section */}
      {totalCount > rowsPerPage && (
        <div className="px-4 py-6 flex items-center justify-between shrink-0 bg-surface border-t border-border-subtle mt-4">
          <div className="text-sm font-medium text-muted-foreground">
            Page <span className="text-foreground">{currentPage}</span>{" "}
            <span className="mx-1 text-text-secondary">/</span> {totalPages}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={currentPage === 1 || loading}
              onClick={() => {
                const newPage = Math.max(1, currentPage - 1);
                const nextF = { ...filters, page: newPage };
                setFilters(nextF);
                handleSearch(undefined, nextF);
              }}
              className="h-10 px-5 rounded-2xl border-border-subtle font-bold text-xs"
            >
              {t("search.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={currentPage >= totalPages || loading}
              onClick={() => {
                const newPage = Math.min(totalPages, currentPage + 1);
                const nextF = { ...filters, page: newPage };
                setFilters(nextF);
                handleSearch(undefined, nextF);
              }}
              className="h-10 px-5 rounded-2xl border-border-subtle font-bold text-xs"
            >
              {t("search.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
