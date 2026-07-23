import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronLeft, LibraryBig, FileText } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFlagUrl } from "@/lib/utils";

interface PublicationInfo {
  publicationcode: string;
  title: string;
  languagecode: string;
  publicationcomment?: string;
  issueCount: number;
}

interface CountryPublicationsProps {
  countrycode: string;
  onBack: () => void;
  onSelectPublication: (code: string) => void;
}

export function CountryPublications({ countrycode, onBack, onSelectPublication }: CountryPublicationsProps) {
  const { t } = useTranslation();
  const [countryName, setCountryName] = useState("");
  const [publications, setPublications] = useState<PublicationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch country name
        const countryRes = await executeQuery({
          sql: "SELECT countryname FROM inducks_country WHERE countrycode = ?",
          args: [countrycode]
        });
        if (countryRes.rows.length > 0) {
          setCountryName(countryRes.rows[0].countryname);
        } else {
          setCountryName(countrycode.toUpperCase());
        }

        // Fetch publications
        const result = await executeQuery({
          sql: `
            SELECT p.publicationcode, p.title, p.languagecode, p.publicationcomment,
                   COALESCE(p.issue_count, 0) as issueCount
            FROM inducks_publication p
            WHERE p.countrycode = ?
            ORDER BY p.title ASC
          `,
          args: [countrycode]
        });
        // Filter out publications that have 0 issues to avoid clutter
        const filtered = (result.rows as PublicationInfo[]).filter(p => p.issueCount > 0);
        setPublications(filtered);
      } catch (err) {
        console.error("Error fetching country publications:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [countrycode]);

  const filteredPublications = React.useMemo(() => {
    return publications.filter(p => 
      p.title.toLowerCase().includes(filterText.toLowerCase()) ||
      p.publicationcode.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [publications, filterText]);

  const flagUrl = getFlagUrl(countrycode);

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
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 rounded-xl border border-border-subtle hover:bg-surface-2"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 truncate">
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt={countrycode}
                  className="w-6 h-4.5 rounded object-cover shadow-xs border border-border-subtle/10 shrink-0"
                />
              )}
              {t("countries.publications_title", { country: countryName }) || `Publications de : ${countryName}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Explorez les magazines et séries Disney publiés dans ce pays.
            </p>
          </div>
        </div>
        <Input
          placeholder={t("countryPubs.search_placeholder") || "Filtrer les publications..."}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full sm:w-64 rounded-xl h-10 border-border-subtle bg-surface"
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPublications.map((p) => (
            <Card
              key={p.publicationcode}
              onClick={() => onSelectPublication(p.publicationcode)}
              className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/20 hover:shadow-md transition-all duration-300 flex justify-between items-center gap-4 border border-border-subtle bg-surface/50 rounded-2xl group"
            >
              <div className="min-w-0 space-y-0.5 flex-1">
                <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors leading-tight">
                  {p.title || "Sans titre"}
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono">{p.publicationcode}</p>
                {p.publicationcomment && (
                  <p className="text-[10.5px] text-text-secondary italic line-clamp-2 mt-1.5 pt-0.5">
                    "{p.publicationcomment}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-surface-2 px-3 py-1 rounded-xl border border-border-subtle shrink-0">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>
                  {p.issueCount} {p.issueCount > 1 ? "numéros" : "numéro"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
