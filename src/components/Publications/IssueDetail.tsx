import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, BookOpen, Calendar, DollarSign, Ruler, Layers, Link as LinkIcon, User } from "lucide-react"
import { getIssueDetail } from "@/lib/turso"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getFlagUrl } from "@/lib/utils"
import { toast } from "sonner"

interface IssueDetailProps {
  issuecode: string
  onBack: () => void
  onSelectStory?: (storycode: string) => void
}

export function IssueDetail({ issuecode, onBack, onSelectStory }: IssueDetailProps) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<any>(null)

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true)
      try {
        const details = await getIssueDetail(issuecode)
        setIssue(details)
      } catch (e) {
        console.error(e)
        toast.error("Impossible de charger les détails du numéro.")
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [issuecode])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-primary/40 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium">{t("common.loading")}</p>
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Numéro introuvable.</p>
        <Button onClick={onBack} variant="outline" className="mt-4 gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
      </div>
    )
  }

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "0000-00-00" || dateStr === "9999-99-99") return t("story.unknown_date") || "Date inconnue"
    const parts = dateStr.split("-")
    if (parts.length < 2) return dateStr
    const year = parts[0]
    const month = parts[1]
    const day = parts.length > 2 ? parts[2] : "00"
    if (month === "00") return year
    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, day === "00" ? 1 : parseInt(day))
      return new Intl.DateTimeFormat(i18n.language === "en" ? "en-US" : "fr-FR", {
        year: "numeric",
        month: "long",
        day: day !== "00" ? "numeric" : undefined,
      }).format(date)
    } catch {
      return dateStr
    }
  }

  // Build high-res cover image URL
  const coverUrl = React.useMemo(() => {
    if (!issue.issue_thumb) return null
    const parts = issue.issue_thumb.split("|")
    const url = parts.length > 1 ? parts[1] : parts[0]
    let baseUrl = url
    if (!url.startsWith("http")) {
      if (parts[0] === "webusers" && !url.startsWith("webusers/")) {
        baseUrl = `https://outducks.org/webusers/webusers/${url}`
      } else {
        baseUrl = `https://outducks.org/${url.startsWith("/") ? url.substring(1) : url}`
      }
    }
    return `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=${baseUrl}`)}`
  }, [issue.issue_thumb])

  return (
    <div className="w-full max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="outline" size="sm" className="rounded-xl gap-1.5 h-9">
          <ArrowLeft className="w-4 h-4" />
          {t("common.back") || "Retour"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Cover & Core Specs */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm overflow-hidden p-2">
            <div className="aspect-[3/4] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 rounded-lg overflow-hidden">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain hover:scale-102 transition-transform duration-500"
                />
              ) : (
                <BookOpen className="w-12 h-12 text-muted-foreground opacity-20" />
              )}
            </div>
          </Card>

          {/* Issue Specs */}
          <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Caractéristiques du numéro
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-text-body">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="font-bold">Date de publication</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(issue.oldestdate)}</p>
                  </div>
                </div>

                {issue.pages && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <Layers className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">Nombre de pages</p>
                      <p className="text-[10px] text-muted-foreground">{issue.pages} pages</p>
                    </div>
                  </div>
                )}

                {issue.price && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <DollarSign className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">Prix de vente</p>
                      <p className="text-[10px] text-muted-foreground">{issue.price}</p>
                    </div>
                  </div>
                )}

                {issue.size && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <Ruler className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">Dimensions / Format</p>
                      <p className="text-[10px] text-muted-foreground">{issue.size}</p>
                    </div>
                  </div>
                )}

                {issue.attached && (
                  <div className="flex items-center gap-3 text-xs text-text-body">
                    <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold">Objet joint / gadget</p>
                      <p className="text-[10px] text-muted-foreground">{issue.attached}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Title, Index of stories */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <img
                src={getFlagUrl(issue.countrycode)}
                className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                alt=""
              />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md">
                {issue.countryname}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {issue.publication_title} #{issue.issuenumber}
            </h1>
            <p className="text-xs font-semibold text-text-secondary">Code : {issuecode}</p>
          </div>

          {/* Index of Stories */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Index des histoires</h3>
            <div className="space-y-3">
              {issue.stories && issue.stories.length > 0 ? (
                issue.stories.map((story: any, idx: number) => (
                  <Card
                    key={story.storycode || idx}
                    onClick={() => story.storycode && onSelectStory && onSelectStory(story.storycode)}
                    className="group rounded-2xl border-border-subtle bg-surface hover:bg-surface-2 transition-all shadow-xs cursor-pointer border hover:border-primary/20"
                  >
                    <CardContent className="p-4 flex items-start gap-4">
                      {/* Position / Index badge */}
                      <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-surface-2 text-[10px] font-bold font-mono text-text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
                        {story.position || idx + 1}
                      </span>
                      
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {story.entry_title || story.original_title || "Sans titre"}
                          </p>
                          {story.entirepages && (
                            <span className="text-[10px] bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded font-bold font-mono shrink-0">
                              {story.entirepages} p.
                            </span>
                          )}
                        </div>

                        {story.original_title && story.original_title !== story.entry_title && (
                          <p className="text-[10px] text-muted-foreground italic truncate">
                            Titre original : {story.original_title}
                          </p>
                        )}

                        {/* Credits */}
                        {(story.writers || story.artists) && (
                          <div className="text-[10px] text-text-secondary space-y-0.5">
                            {story.writers && (
                              <p className="truncate">
                                <span className="font-semibold">Scénario :</span> {story.writers}
                              </p>
                            )}
                            {story.artists && (
                              <p className="truncate">
                                <span className="font-semibold">Dessin :</span> {story.artists}
                              </p>
                            )}
                          </div>
                        )}

                        {story.storycode && (
                          <p className="text-[9px] font-mono font-bold text-primary truncate pt-1">
                            {story.storycode}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-text-secondary italic">Aucune histoire référencée pour ce numéro.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
