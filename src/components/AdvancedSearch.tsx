import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { CollectionManagerDialog } from "./CollectionManagerDialog";
import { useMetadata } from "@/hooks/useMetadata";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import { useSearchExecution } from "@/hooks/useSearchExecution";
import { SearchForm } from "./Search/SearchForm";
import { SearchResults } from "./Search/SearchResults";

export function AdvancedSearch() {
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const { meta } = useMetadata();
  const {
    filters,
    setFilters,
    pagesSliderMoved,
    setPagesSliderMoved,
    selectedLabels,
    setSelectedLabels,
    cookieValue,
    setCookieValue,
    isSavingCookie,
    isSettingsOpen,
    setIsSettingsOpen,
    addSelection,
    removeSelection,
    saveCookie,
    handleClearFilters,
  } = useSearchFilters();

  const {
    results,
    totalCount,
    loading,
    setResults,
    setTotalCount,
    handleSearch,
    lastSearchFilters,
  } = useSearchExecution({
    filters,
    pagesSliderMoved,
  });

  return (
    <div className="h-full flex flex-col overflow-auto lg:overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 lg:p-8 gap-8 px-4 lg:px-12">
        <SearchForm
          filters={filters}
          setFilters={setFilters}
          pagesSliderMoved={pagesSliderMoved}
          setPagesSliderMoved={setPagesSliderMoved}
          selectedLabels={selectedLabels}
          setSelectedLabels={setSelectedLabels}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          cookieValue={cookieValue}
          setCookieValue={setCookieValue}
          isSavingCookie={isSavingCookie}
          saveCookie={saveCookie}
          addSelection={addSelection}
          removeSelection={removeSelection}
          handleClearFilters={handleClearFilters}
          handleSearch={handleSearch}
          loading={loading}
          meta={meta}
          setResults={setResults}
          setTotalCount={setTotalCount}
          collectionDialogOpen={collectionDialogOpen}
          setCollectionDialogOpen={setCollectionDialogOpen}
        />
        <SearchResults
          results={results}
          totalCount={totalCount}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          handleSearch={handleSearch}
          isInitialState={lastSearchFilters === null}
        />
      </div>
      <CollectionManagerDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
      />
    </div>
  );
}
