import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { useMetadata } from "@/hooks/useMetadata";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import { useSearchExecution } from "@/hooks/useSearchExecution";
import { SearchForm } from "./Search/SearchForm";
import { SearchResults } from "./Search/SearchResults";
import { StoryDetail } from "./Search/StoryDetail";
import { IssueDetail } from "./Publications/IssueDetail";

interface AdvancedSearchProps {
  selectedStorycode: string | null;
  setSelectedStorycode: (code: string | null) => void;
  selectedIssuecode: string | null;
  setSelectedIssuecode: (code: string | null) => void;
  /**
   * Ouvre la fiche d'un personnage depuis une histoire.
   *
   * Le clic filtrait auparavant la recherche d'histoires sur ce personnage. C'est utile,
   * mais ce n'est pas ce qu'on attend d'un nom cliquable dans une fiche : on veut voir le
   * personnage. Le filtrage reste accessible depuis le formulaire de recherche.
   */
  onOpenCharacter?: (code: string) => void;
}

export function AdvancedSearch({
  selectedStorycode,
  setSelectedStorycode,
  selectedIssuecode,
  setSelectedIssuecode,
  onOpenCharacter
}: AdvancedSearchProps) {
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

  const handleSelectCharacter = (code: string, name: string) => {
    if (onOpenCharacter) {
      onOpenCharacter(code);
      return;
    }
    setSelectedStorycode(null);
    setSelectedIssuecode(null);
    addSelection("charactercode", code, name);
    const newFilters = {
      ...filters,
      charactercode: Array.from(new Set([...(filters.charactercode || []), code])),
      page: 1
    };
    setFilters(newFilters);
    handleSearch(null, newFilters);
  };

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
          onSelectCharacter={handleSelectCharacter}
        />
      </div>
    );
  }

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
        />
        <SearchResults
          results={results}
          totalCount={totalCount}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          handleSearch={handleSearch}
          isInitialState={lastSearchFilters === null}
          onSelect={(code) => setSelectedStorycode(code)}
          onSelectCharacter={handleSelectCharacter}
        />
      </div>
    </div>
  );
}
