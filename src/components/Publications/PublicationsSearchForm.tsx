import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Autocomplete } from "@/components/Autocomplete";
import { parseISO, format } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PublicationsSearchFilters } from "@/lib/searchService";
import { MetaData, COUNTRY_CONTINENTS } from "@/lib/types";
import { autocompletePublisher, autocompletePerson, autocompletePublicationTitle } from "@/lib/turso";

import { getFlagUrl } from "@/lib/utils";

interface PublicationsSearchFormProps {
  filters: PublicationsSearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<PublicationsSearchFilters>>;
  handleSearch: (e?: React.FormEvent | null, overrideFilters?: PublicationsSearchFilters) => Promise<void>;
  handleClearFilters: () => void;
  loading: boolean;
  meta: MetaData;
}

export function PublicationsSearchForm({
  filters,
  setFilters,
  handleSearch,
  handleClearFilters,
  loading,
  meta,
}: PublicationsSearchFormProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col border-border-subtle/60 dark:border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface min-h-[600px] lg:min-h-0">
      <div className="px-8 py-5 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-3">
          {t("search.publications_title") || "Recherche de Publications"}
        </h2>
      </div>

      <ScrollArea className="flex-1 w-full bg-surface">
        <div className="p-4 lg:p-8 pt-0">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6" onSubmit={(e) => handleSearch(e)}>
            
            {/* Country */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publication_country")}</Label>
              <Select
                value={filters.country || "all"}
                onValueChange={(val) => setFilters({ ...filters, country: val === "all" ? "" : val })}
              >
                <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm hover:bg-surface-2">
                  <SelectValue placeholder={t("search.any_country")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60 border-border-subtle bg-surface">
                  <SelectItem value="all">{t("search.any_country")}</SelectItem>
                  {meta.countries.map((c: any) => (
                    <SelectItem key={c.countrycode} value={c.countrycode}>
                      <div className="flex items-center gap-2">
                        <img
                          src={getFlagUrl(c.countrycode)}
                          className="w-4 h-3 rounded-xs shrink-0"
                          alt=""
                        />
                        <span>{c.countryname}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.title_pub_label") || "Titre (série ou numéro)"}</Label>
              <Autocomplete
                value={filters.title}
                placeholder={t("search.title_pub_placeholder")}
                emptyMessage={t("common.no_data")}
                fetchOptions={autocompletePublicationTitle}
                onSelect={(val) => setFilters({ ...filters, title: val })}
                onInputChange={(val) => setFilters({ ...filters, title: val })}
                onClear={() => setFilters({ ...filters, title: "" })}
                type="publications"
                hideIcon={true}
                hideSearchIcon={true}
              />
            </div>

            {/* Issue Number */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.issue_number") || "Numéro de parution"}</Label>
              <Input
                variant="search"
                placeholder={t("search.issue_number_placeholder") || "Ex: 123, 1A..."}
                value={filters.issuenumber || ""}
                onChange={(e) => setFilters({ ...filters, issuenumber: e.target.value })}
              />
            </div>

            {/* Publication Period */}
            <div className="space-y-2 col-span-1 md:col-span-2">
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

            {/* Publisher */}
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
            </div>

            {/* Indexer */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.indexer") || "Indexeur"}</Label>
              <Autocomplete
                value={filters.indexer}
                placeholder={t("search.indexer_placeholder") || "Nom de l'indexeur..."}
                emptyMessage={t("common.no_data")}
                fetchOptions={autocompletePerson}
                onSelect={(val) => setFilters({ ...filters, indexer: val })}
                onInputChange={(val) => setFilters({ ...filters, indexer: val })}
                onClear={() => setFilters({ ...filters, indexer: "" })}
                type="authors"
                hideIcon={true}
                hideSearchIcon={true}
              />
            </div>

            {/* Checkbox Collects & Show Specific Title */}
            <div className="col-span-1 md:col-span-2 space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="collects"
                  checked={filters.collects === true}
                  onCheckedChange={(checked) => setFilters({ ...filters, collects: checked === true })}
                />
                <label htmlFor="collects" className="text-xs text-text-secondary cursor-pointer leading-snug">
                  {t("search.issue_collects") || "Ce numéro en recueille un ou plusieurs autres"}
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  {t("search.specific_title") || "Titre spécifique du numéro"}
                </Label>
                <Input
                  variant="search"
                  placeholder={t("search.specific_title_placeholder") || "Ex: La Dynastie des Donalds..."}
                  value={filters.specificTitle || ""}
                  onChange={(e) => setFilters({ ...filters, specificTitle: e.target.value })}
                />
              </div>
            </div>

            {/* Pages */}
            <div className="space-y-2 col-span-1 md:col-span-2 pt-2 border-t border-border-subtle">
              <Label className="text-sm font-medium text-foreground">{t("search.pages") || "Pages"}</Label>
              <Input
                variant="search"
                type="number"
                placeholder={t("search.pages_placeholder") || "Ex: 48..."}
                value={filters.pages !== undefined ? filters.pages : ""}
                onChange={(e) => setFilters({ ...filters, pages: e.target.value ? parseInt(e.target.value) : undefined })}
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.price") || "Prix"}</Label>
              <Input
                variant="search"
                placeholder={t("search.price_placeholder") || "Ex: 5.50 FRF, 2.50 EUR..."}
                value={filters.price || ""}
                onChange={(e) => setFilters({ ...filters, price: e.target.value })}
              />
            </div>

            {/* Attached */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.attached") || "Supplément / Objet attaché"}</Label>
              <Input
                variant="search"
                placeholder={t("search.attached_placeholder") || "Ex: autocollants, gadget..."}
                value={filters.attached || ""}
                onChange={(e) => setFilters({ ...filters, attached: e.target.value })}
              />
            </div>

            {/* Size */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label className="text-sm font-medium text-foreground">{t("search.dimensions") || "Format / Dimensions"}</Label>
              <Input
                variant="search"
                placeholder={t("search.dimensions_placeholder") || "Ex: 17x25, A4..."}
                value={filters.size || ""}
                onChange={(e) => setFilters({ ...filters, size: e.target.value })}
              />
            </div>

            {/* Display options: Show Covers */}
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-border-subtle flex items-center gap-2">
              <Checkbox
                id="showCovers"
                checked={filters.showCovers !== false}
                onCheckedChange={(checked) => setFilters({ ...filters, showCovers: checked !== false })}
              />
              <label htmlFor="showCovers" className="text-xs text-text-secondary cursor-pointer">
                {t("search.show_covers") || "Afficher les couvertures"}
              </label>
            </div>

          </form>
        </div>
      </ScrollArea>

      <div className="p-4 lg:p-8 border-t border-border-subtle bg-surface flex flex-col sm:flex-row gap-4 shrink-0">
        <Button
          variant="outline"
          className="flex-1 h-12 border-border-subtle text-text-secondary font-medium text-sm bg-surface hover:bg-surface-2 hover:text-foreground transition-all rounded-2xl"
          onClick={handleClearFilters}
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
