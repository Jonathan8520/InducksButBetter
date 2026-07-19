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

interface SearchResultsProps<TFilters = any> {
  results: any[];
  totalCount: number;
  loading: boolean;
  filters: TFilters;
  setFilters: React.Dispatch<React.SetStateAction<TFilters>>;
  handleSearch: (e?: React.FormEvent | null, overrideFilters?: TFilters) => Promise<void>;
  isInitialState: boolean;
  sortOptions?: { value: string; labelKey: string }[];
  renderResultCard?: (row: any, index: number) => React.ReactNode;
  renderSkeleton?: (index: number) => React.ReactNode;
  foundLabel?: string;
}

export function SearchResults<TFilters extends { sort?: string; page?: number | string; rowsperpage?: string | number } = any>({
  results,
  totalCount,
  loading,
  filters,
  setFilters,
  handleSearch,
  isInitialState,
  sortOptions,
  renderResultCard,
  renderSkeleton,
  foundLabel,
}: SearchResultsProps<TFilters>) {
  const { t } = useTranslation();
  const rowsPerPage = parseInt(String(filters.rowsperpage || "24"), 10) || 24;
  const currentPage = parseInt(String(filters.page || "1"), 10) || 1;
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const defaultSortOptions = [
    { value: "pubdate_desc", labelKey: "sort.pubdate_desc" },
    { value: "pubdate_asc", labelKey: "sort.pubdate_asc" },
    { value: "title_az", labelKey: "sort.title_az" },
    { value: "title_za", labelKey: "sort.title_za" },
    { value: "pages_desc", labelKey: "sort.pages_desc" },
    { value: "pages_asc", labelKey: "sort.pages_asc" },
    { value: "published_most", labelKey: "sort.published_most" },
    { value: "published_least", labelKey: "sort.published_least" },
  ];

  const actualSortOptions = sortOptions || defaultSortOptions;
  const actualRenderCard = renderResultCard || ((row: any, i: number) => <StoryResultCard row={row} />);
  const actualRenderSkeleton = renderSkeleton || ((i: number) => <StoryResultSkeleton key={i} />);
  const actualFoundLabel = foundLabel !== undefined ? foundLabel : t("search.stories_found", { count: totalCount });

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
                {actualSortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="rounded-lg">
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {totalCount > 0 && (
          <Badge variant="secondary" className="bg-primary text-primary-foreground border-none px-3 font-bold">
            {actualFoundLabel}
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <ScrollArea className="h-full pr-4">
            <div className="grid grid-cols-1 gap-6 pb-12 opacity-70">
              {[1, 2, 3, 4].map((i) => actualRenderSkeleton(i))}
            </div>
          </ScrollArea>
        ) : results.length > 0 ? (
          <ScrollArea className="h-full pr-4">
            <div className="grid grid-cols-1 gap-6 pb-12">
              {results.map((row: any, i: number) => (
                <div
                  key={row.issuecode || row.storycode || i}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                >
                  {actualRenderCard(row, i)}
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
