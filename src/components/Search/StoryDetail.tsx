import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Copy, Check, Calendar, BookOpen, User, Users, FileText, ChevronDown, ChevronUp, Link } from "lucide-react"
import { getStoryDetail } from "@/lib/turso"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getFlagUrl } from "@/lib/utils"
import { toast } from "sonner"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface StoryDetailProps {
  storycode: string
  onBack: () => void
  onSelectIssue?: (issuecode: string) => void
  onSelectCharacter?: (code: string, name: string) => void
}

export function StoryDetail({ storycode, onBack, onSelectIssue, onSelectCharacter }: StoryDetailProps) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [story, setStory] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  // Accordion states
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({})
  const [showAllDescriptions, setShowAllDescriptions] = useState(false)

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true)
      try {
        const details = await getStoryDetail(storycode, i18n.language)
        setStory(details)
      } catch (e) {
        console.error(e)
        toast.error("Impossible de charger les détails de l'histoire.")
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [storycode, i18n.language])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(storycode)
    setCopied(true)
    toast.success("Code copié dans le presse-papiers !")
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-primary/40 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium">{t("common.loading")}</p>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Histoire introuvable.</p>
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

  // Group publications by country
  const publicationsByCountry: Record<string, any[]> = {}
  story.publications?.forEach((pub: any) => {
    const country = pub.countryname || pub.countrycode || "Other"
    if (!publicationsByCountry[country]) {
      publicationsByCountry[country] = []
    }
    publicationsByCountry[country].push(pub)
  })

  const toggleCountry = (country: string) => {
    setExpandedCountries((prev) => ({
      ...prev,
      [country]: !prev[country],
    }))
  }

  const defaultDesc =
    story.descriptions?.find((d: any) => d.languagecode === i18n.language) ||
    story.descriptions?.find((d: any) => d.languagecode === "en") ||
    story.descriptions?.[0] ||
    (story.plotsummary ? { languagecode: "original", desctext: story.plotsummary } : null)

  const otherDescriptions = story.descriptions?.filter((d: any) => d.languagecode !== defaultDesc?.languagecode) || []

  // Group creators by job type and deduplicate by personcode
  const writers = (story.creators?.filter((c: any) => ["w", "p", "pw"].includes(c.role)) || [])
    .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.personcode === v.personcode) === i)
  const artists = (story.creators?.filter((c: any) => ["a", "i", "pa"].includes(c.role)) || [])
    .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.personcode === v.personcode) === i)
  const others = (story.creators?.filter((c: any) => !["w", "p", "pw", "a", "i", "pa"].includes(c.role)) || [])
    .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.personcode === v.personcode) === i)

  return (
    <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="outline" size="sm" className="rounded-xl gap-1.5 h-9">
          <ArrowLeft className="w-4 h-4" />
          {t("common.back") || "Retour"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left/Middle Content: Main Story Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {story.story_title || "Sans titre"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              <span className="font-semibold">{story.series_title}</span>
              {story.firstpublicationdate && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(story.firstpublicationdate)}
                  </span>
                </>
              )}
              <div className="flex items-center gap-1.5 ml-2">
                <Badge variant="secondary" className="font-medium text-[10px]">
                  {story.kind ? t(`kinds.${story.kind}`, story.kind) : t("kinds.s")}
                </Badge>
                {(story.entirepages || story.brokenpagenumerator) && (
                  <Badge variant="outline" className="font-medium text-[10px] gap-1 bg-surface">
                    <FileText className="w-3 h-3" />
                    {story.entirepages ? `${story.entirepages} pages` : `${story.brokenpagenumerator}/${story.brokenpagedenominator} page`}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Copyable Story Code */}
          <div className="flex items-center gap-3 p-3 bg-surface-2 border border-border-subtle rounded-2xl">
            <div className="space-y-0.5 flex-1">
              <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Code de l'histoire</p>
              <p className="font-mono text-sm font-bold text-foreground">{storycode}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={copyToClipboard} className="h-9 w-9 hover:bg-surface rounded-xl">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-text-secondary" />}
            </Button>
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Synopsis & Description
            </h3>
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-4">
                {defaultDesc ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {defaultDesc.languagecode}
                      </span>
                    </div>
                    <p className="text-sm text-text-body leading-relaxed whitespace-pre-wrap">{defaultDesc.desctext}</p>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary italic">Aucune description disponible.</p>
                )}

                {/* Accordion for descriptions in other languages */}
                {otherDescriptions.length > 0 && (
                  <div className="pt-2 border-t border-border-subtle">
                    <button
                      onClick={() => setShowAllDescriptions(!showAllDescriptions)}
                      className="flex items-center justify-between w-full text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                    >
                      <span>
                        {showAllDescriptions
                          ? "Masquer les autres langues"
                          : `Afficher les descriptions dans d'autres langues (${otherDescriptions.length})`}
                      </span>
                      {showAllDescriptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showAllDescriptions && (
                      <div className="mt-4 space-y-4 animate-fadeIn">
                        {otherDescriptions.map((desc: any) => (
                          <div key={desc.languagecode} className="space-y-1 pt-3 border-t border-border-subtle/50 first:border-none first:pt-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase font-bold bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded">
                                {desc.languagecode}
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{desc.desctext}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Creators Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Auteurs / Créateurs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Writers */}
              <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    Scénaristes
                  </h4>
                  {writers.length > 0 ? (
                    <ul className="space-y-1">
                      {writers.map((c: any) => (
                        <li key={`${c.personcode}-${c.role}`} className="text-sm font-semibold text-foreground">
                          {c.fullname}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-secondary italic">Non crédité.</p>
                  )}
                </CardContent>
              </Card>

              {/* Artists */}
              <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    Dessinateurs
                  </h4>
                  {artists.length > 0 ? (
                    <ul className="space-y-1">
                      {artists.map((c: any) => (
                        <li key={`${c.personcode}-${c.role}`} className="text-sm font-semibold text-foreground">
                          {c.fullname}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-secondary italic">Non crédité.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Right Content: Cover / Characters / Publications */}
        <div className="space-y-6">
          {/* Story Thumbnail (if available) */}
          {story.story_thumb && (
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm overflow-hidden">
              <div className="aspect-[4/3] w-full flex items-center justify-center p-2 bg-zinc-50 dark:bg-zinc-800">
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(
                    story.story_thumb.split("|")[1] || story.story_thumb
                  )}`}
                  alt=""
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              </div>
            </Card>
          )}

          {/* Characters Panel */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Personnages</h3>
            <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
              <CardContent className="p-4">
                {story.characters && story.characters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {story.characters.map((c: any) => {
                      const avatarUrl = `/api/proxy-image?url=${encodeURIComponent(
                        `https://inducks.org/characterthumb.php?c=${c.charactercode}`
                      )}`
                      return (
                        <Tooltip key={c.charactercode} delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div
                              className="flex items-center gap-2 bg-surface-2 border border-border-subtle px-2.5 py-1 rounded-xl text-xs font-semibold text-text-body cursor-pointer hover:bg-surface-3 active:scale-98 transition-all"
                              onClick={() => onSelectCharacter && onSelectCharacter(c.charactercode, c.charactername || c.charactercode)}
                            >
                              <img
                                src={avatarUrl}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                }}
                              />
                              <span>{c.charactername || c.charactercode}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px] text-xs leading-relaxed">
                            <div className="flex flex-col gap-0.5">
                              <p className="font-bold text-foreground">{c.charactername || c.charactercode}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{c.charactercode}</p>
                              {c.charactercomment && (
                                <p className="text-[10px] text-text-secondary mt-1 border-t border-border-subtle pt-1 italic">
                                  {c.charactercomment}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary italic">Aucun personnage répertorié.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Publications by Country (Collapsible Accordion!) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Publications par pays</h3>
            <div className="space-y-2">
              {Object.keys(publicationsByCountry).map((country) => {
                const pubs = publicationsByCountry[country]
                const flagCode = pubs[0]?.countrycode || "un"
                const isExpanded = !!expandedCountries[country]
                return (
                  <div
                    key={country}
                    className="border border-border-subtle bg-surface rounded-2xl overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      onClick={() => toggleCountry(country)}
                      className="w-full flex items-center justify-between p-3 px-4 hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={getFlagUrl(flagCode)}
                          className="w-4 h-3 rounded-xs shrink-0 object-cover"
                          alt=""
                        />
                        <span className="text-xs font-bold text-text-body">{country}</span>
                        <span className="text-[10px] bg-surface-2 text-text-secondary px-1.5 py-0.5 rounded-md font-bold font-mono">
                          {pubs.length}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border-subtle bg-surface-2/30 p-2 space-y-1.5 animate-fadeIn">
                        {pubs.map((pub: any) => (
                          <div
                            key={pub.entrycode}
                            onClick={() => onSelectIssue && onSelectIssue(pub.issuecode)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer border border-transparent hover:border-border-subtle"
                          >
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-foreground">{pub.publication_title}</p>
                              <p className="text-[10px] text-muted-foreground font-medium">
                                Numéro : {pub.issuenumber} {pub.position && `• Pos. ${pub.position}`}
                              </p>
                            </div>
                            <div className="text-right">
                              {pub.entirepages && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                                  {pub.entirepages} p.
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple loader helper inline
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
