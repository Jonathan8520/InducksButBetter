import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { executeQuery } from "@/lib/db";
import { useMetadata } from "@/hooks/useMetadata";
import { PublicationsSearchForm } from "./PublicationsSearchForm";
import { SearchResults } from "@/components/Search/SearchResults";
import { IssueResultCard } from "@/components/IssueResultCard";
import IssueResultSkeleton from "@/components/IssueResultSkeleton";
import { buildPublicationsSearchQuery, PublicationsSearchFilters } from "@/lib/searchService";
import { StoryDetail } from "@/components/Search/StoryDetail";
import { IssueDetail } from "./IssueDetail";

const initialFilters: PublicationsSearchFilters = {
  country: "",
  title: "",
  issuenumber: "",
  dateAfter: "",
  dateBefore: "",
  publisherid: "",
  indexer: "",
  collects: false,
  specificTitle: "",
  pages: undefined,
  price: "",
  attached: "",
  size: "",
  showCovers: true,
  sort: "country_code",
  page: 1,
  rowsperpage: "24",
};

export function PublicationsSearch() {
  const { t, i18n } = useTranslation();
  const { meta } = useMetadata();
  const [filters, setFilters] = useState<PublicationsSearchFilters>(initialFilters);
  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastFilters, setLastFilters] = useState<PublicationsSearchFilters | null>(null);

  const [selectedStorycode, setSelectedStorycode] = useState<string | null>(null);
  const [selectedIssuecode, setSelectedIssuecode] = useState<string | null>(null);

  const performSearch = async (searchFilters: PublicationsSearchFilters) => {
    setLoading(true);
    try {
      const { query, countQuery, params, countParams } = buildPublicationsSearchQuery(searchFilters);
      
      setResults([]);
      
      const countResult = await executeQuery({ sql: countQuery, args: countParams });
      setTotalCount(Number(countResult.rows[0]?.total || countResult.rows[0]?.COUNT || 0));

      await executeQuery({ sql: query, args: params }, (newRow) => {
        setResults((prev) => [...prev, newRow]);
      });
    } catch (err) {
      console.error(err);
      toast.error(t("search.error_fetch", { defaultValue: "Erreur: impossible de récupérer les données." }));
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent | null, overrideFilters?: PublicationsSearchFilters) => {
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

  useEffect(() => {
    if (lastFilters) {
      performSearch(lastFilters);
    }
  }, [i18n.language]);

  const sortOptions = [
    { value: "country_code", labelKey: "sort.country_code" },
    { value: "date_asc", labelKey: "sort.date_asc" },
    { value: "date_desc", labelKey: "sort.date_desc" },
    { value: "pages_asc", labelKey: "sort.pages_asc" },
    { value: "pages_desc", labelKey: "sort.pages_desc" },
  ];

  if (selectedIssuecode) {
    return (
      <div className="h-full overflow-auto bg-surface-2/20">
        <IssueDetail
          issuecode={selectedIssuecode}
          onBack={() => setSelectedIssuecode(null)}
          onSelectStory={(code) => {
            setSelectedStorycode(code);
            setSelectedIssuecode(null);
          }}
        />
      </div>
    );
  }

  if (selectedStorycode) {
    return (
      <div className="h-full overflow-auto bg-surface-2/20">
        <StoryDetail
          storycode={selectedStorycode}
          onBack={() => setSelectedStorycode(null)}
          onSelectIssue={(code) => setSelectedIssuecode(code)}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto lg:overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 lg:p-8 gap-8 px-4 lg:px-12">
        <PublicationsSearchForm
          filters={filters}
          setFilters={setFilters}
          handleSearch={handleSearch}
          handleClearFilters={handleClearFilters}
          loading={loading}
          meta={meta}
        />
        <SearchResults
          results={results}
          totalCount={totalCount}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          handleSearch={handleSearch}
          isInitialState={lastFilters === null}
          sortOptions={sortOptions}
          renderResultCard={(row) => <IssueResultCard row={row} onSelect={(code) => setSelectedIssuecode(code)} />}
          renderSkeleton={(i) => <IssueResultSkeleton key={i} />}
          foundLabel={t("search.publications_found", { count: totalCount, defaultValue: `${totalCount} publications trouvées` })}
          onSelect={(code) => setSelectedIssuecode(code)}
        />
      </div>
    </div>
  );
}
