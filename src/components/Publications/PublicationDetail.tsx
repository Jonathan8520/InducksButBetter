import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronLeft, LibraryBig, FileText, Globe, BookOpen } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IssueResultCard } from "@/components/IssueResultCard";
import { getFlagUrl } from "@/lib/utils";

interface PublicationDetailData {
  publicationcode: string;
  title: string;
  countrycode: string;
  languagecode: string;
  publicationcomment?: string;
  publishername?: string;
}

interface PublicationDetailProps {
  publicationcode: string;
  onBack: () => void;
  onSelectIssue: (code: string) => void;
}

export function PublicationDetail({ publicationcode, onBack, onSelectIssue }: PublicationDetailProps) {
  const { t } = useTranslation();
  const [publication, setPublication] = useState<PublicationDetailData | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch publication details and publisher
        const pubResult = await executeQuery({
          sql: `
            SELECT p.publicationcode, p.title, p.countrycode, p.languagecode, p.publicationcomment,
                   (SELECT pub.publishername 
                    FROM inducks_publishingjob pj 
                    JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid 
                    JOIN inducks_issue i ON pj.issuecode = i.issuecode
                    WHERE i.publicationcode = p.publicationcode 
                    LIMIT 1) as publishername
            FROM inducks_publication p
            WHERE p.publicationcode = ?
          `,
          args: [publicationcode]
        });

        if (pubResult.rows.length > 0) {
          setPublication(pubResult.rows[0] as PublicationDetailData);

          // Fetch all issues of this publication with details matching IssueResultCard requirements
          const issuesResult = await executeQuery({
            sql: `
              SELECT i.issuecode, i.issuenumber, i.title as issue_title, i.pages, i.price, i.oldestdate, i.size, i.attached,
                     p.title as series_title, p.countrycode, p.publicationcode,
                     (SELECT pub.publishername FROM inducks_publishingjob pj JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid WHERE pj.issuecode = i.issuecode LIMIT 1) as publishername,
                     (SELECT eu.sitecode || '|' || eu.url 
                      FROM inducks_entry e 
                      JOIN inducks_entryurl eu ON e.entrycode = eu.entrycode 
                      WHERE e.issuecode = i.issuecode 
                      LIMIT 1) as issue_thumb
              FROM inducks_issue i
              JOIN inducks_publication p ON i.publicationcode = p.publicationcode
              WHERE i.publicationcode = ?
              ORDER BY i.oldestdate ASC, i.issuenumber ASC
            `,
            args: [publicationcode]
          });
          setIssues(issuesResult.rows);
        }
      } catch (err) {
        console.error("Error fetching publication detail:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [publicationcode]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{t("publication.empty") || "Magazine introuvable."}</p>
      </div>
    );
  }

  const flagUrl = getFlagUrl(publication.countrycode);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-3 shrink-0">
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
            <LibraryBig className="w-5 h-5 text-primary shrink-0" />
            {publication.title}
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{publication.publicationcode}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Side: Publication Metadata Card */}
        <div className="lg:col-span-1 space-y-6 shrink-0">
          <Card className="border-border-subtle bg-surface/50 rounded-2xl">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex justify-between py-1 border-b border-border-subtle/30">
                <span className="font-bold text-muted-foreground">{t("publication.code") || "Code"}</span>
                <span className="font-semibold text-foreground font-mono">{publication.publicationcode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle/30 items-center">
                <span className="font-bold text-muted-foreground">{t("publication.country") || "Pays"}</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  {flagUrl && (
                    <img
                      src={flagUrl}
                      alt={publication.countrycode}
                      className="w-4 h-3 rounded object-cover shadow-xs border border-border-subtle/10 shrink-0"
                    />
                  )}
                  {publication.countrycode.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle/30">
                <span className="font-bold text-muted-foreground">{t("publication.language") || "Langue"}</span>
                <span className="font-semibold text-foreground uppercase">{publication.languagecode}</span>
              </div>
              {publication.publishername && (
                <div className="flex justify-between py-1 border-b border-border-subtle/30">
                  <span className="font-bold text-muted-foreground">{t("publication.publisher") || "Éditeur"}</span>
                  <span className="font-semibold text-foreground text-right">{publication.publishername}</span>
                </div>
              )}
              {publication.publicationcomment && (
                <div className="pt-2 leading-relaxed text-text-secondary italic">
                  "{publication.publicationcomment}"
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Scrollable Issues list */}
        <div className="lg:col-span-2 flex flex-col min-h-0 h-full">
          <Card className="border-border-subtle rounded-2xl flex-1 flex flex-col overflow-hidden bg-surface/30">
            <CardHeader className="py-4 border-b border-border-subtle shrink-0">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {t("publication.issues") || "Liste des numéros"}
                </span>
                <Badge variant="secondary" className="font-bold text-xs">
                  {issues.length} {issues.length > 1 ? "numéros" : "numéro"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto min-h-0">
              {issues.length === 0 ? (
                <div className="text-center py-20 text-xs text-muted-foreground">
                  {t("publication.empty") || "Aucun numéro trouvé."}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 pb-4">
                  {issues.map((issue) => (
                    <IssueResultCard
                      key={issue.issuecode}
                      row={issue}
                      onSelect={(code) => onSelectIssue(code)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
