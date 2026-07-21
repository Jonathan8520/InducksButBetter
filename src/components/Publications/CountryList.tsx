import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Globe, LibraryBig } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFlagUrl } from "@/lib/utils";

interface CountryInfo {
  countrycode: string;
  countryname: string;
  pubCount: number;
}

interface CountryListProps {
  onSelectCountry: (code: string) => void;
}

export function CountryList({ onSelectCountry }: CountryListProps) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    const fetchCountries = async () => {
      setLoading(true);
      try {
        const result = await executeQuery({
          sql: `
            SELECT c.countrycode, c.countryname, 
                   (SELECT COUNT(*) FROM inducks_publication WHERE countrycode = c.countrycode) as pubCount
            FROM inducks_country c
            ORDER BY c.countryname ASC
          `
        });
        // Filter out countries that have 0 publications to avoid clutter
        const filtered = (result.rows as CountryInfo[]).filter(c => c.pubCount > 0);
        setCountries(filtered);
      } catch (err) {
        console.error("Error fetching countries:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCountries();
  }, []);

  const filteredCountries = countries.filter(c => 
    c.countryname.toLowerCase().includes(filterText.toLowerCase()) ||
    c.countrycode.toLowerCase().includes(filterText.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {t("countries.title") || "Liste des pays"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sélectionnez un pays pour explorer ses publications Disney.
          </p>
        </div>
        <Input
          placeholder={t("countries.search_placeholder") || "Filtrer les pays..."}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full sm:w-64 rounded-xl h-10 border-border-subtle bg-surface"
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredCountries.map((c) => {
            const flagUrl = getFlagUrl(c.countrycode);
            return (
              <Card
                key={c.countrycode}
                onClick={() => onSelectCountry(c.countrycode)}
                className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/20 hover:shadow-md transition-all duration-300 flex items-center gap-3.5 border border-border-subtle bg-surface/50 rounded-2xl group"
              >
                {flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={c.countrycode}
                    className="w-8 h-5.5 rounded object-cover shadow-sm shrink-0 border border-border-subtle/10 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <Globe className="w-8 h-8 text-muted-foreground/30 shrink-0" />
                )}
                <div className="min-w-0 space-y-0.5">
                  <h3 className="font-semibold text-foreground text-xs truncate group-hover:text-primary transition-colors">
                    {c.countryname}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <LibraryBig className="w-3 h-3 text-primary shrink-0" />
                    <span>
                      {c.pubCount} {c.pubCount > 1 ? "séries" : "série"}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
