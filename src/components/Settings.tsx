import React, { useState, useEffect, useRef } from "react"
import { useTranslation, Trans } from "react-i18next"
import { Database, Loader2, Upload, Save, Globe, Sun, Moon, Monitor, ExternalLink, HelpCircle, Github, Scale, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadFromIsvFiles, hasLocalDb, getLocalDbStats } from "@/lib/localDb"
import { LegalModal } from "@/components/LegalModal"

export function Settings() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  // 1. Inducks Cookie State
  const [cookieValue, setCookieValue] = useState("")
  const [isSavingCookie, setIsSavingCookie] = useState(false)

  useEffect(() => {
    // Load existing cookie from localStorage or retrieve from API
    const loadCookie = async () => {
      try {
        const saved = localStorage.getItem("inducks_cookie")
        if (saved) {
          setCookieValue(saved)
        } else {
          const res = await fetch("/api/settings/cookie")
          if (res.ok) {
            const data = await res.json()
            if (data.cookie) {
              setCookieValue(data.cookie)
              localStorage.setItem("inducks_cookie", data.cookie)
            }
          }
        }
      } catch (e) {
        console.error("Failed to load cookie", e)
      }
    }
    loadCookie()
  }, [])

  const handleSaveCookie = async () => {
    setIsSavingCookie(true)
    try {
      localStorage.setItem("inducks_cookie", cookieValue)
      const res = await fetch("/api/settings/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue }),
      })
      if (res.ok) {
        toast.success(t("settings.cookie_saved") || "Cookie enregistré avec succès !")
      } else {
        toast.error("Erreur serveur lors de la sauvegarde.")
      }
    } catch (e) {
      toast.error("Impossible de sauvegarder le cookie.")
    } finally {
      setIsSavingCookie(false)
    }
  }

  // 2. Local Database State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoadingDb, setIsLoadingDb] = useState(false)
  const [isActiveDb, setIsActiveDb] = useState(hasLocalDb())
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const dbStats = getLocalDbStats()

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsLoadingDb(true)
    setProgressMsg(t("localDb.progress_start"))
    
    const toastId = "settings-db-upload"
    toast.loading(
      <div className="flex flex-col gap-2 w-full min-w-[200px] mt-1">
        <span className="text-sm font-medium">{t("localDb.progress_start")}</span>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: '0%' }}></div>
        </div>
      </div>, 
      { id: toastId }
    )

    try {
      await loadFromIsvFiles(Array.from(files), (progress) => {
        const msg = t("localDb.progress_importing", { table: progress.table, current: progress.current, total: progress.total })
        setProgressMsg(msg)
        const percent = Math.round((progress.current / progress.total) * 100)
        
        toast.loading(
          <div className="flex flex-col gap-2 w-full min-w-[200px] mt-1">
            <span className="text-sm font-medium">{msg}</span>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }}></div>
            </div>
          </div>,
          { id: toastId }
        )
      })
      setIsActiveDb(true)
      toast.success(t("localDb.success") || "Base de données locale importée avec succès !", { id: toastId })
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || "Failed to load database", { id: toastId })
    } finally {
      setIsLoadingDb(false)
      setProgressMsg(null)
    }
  }

  // 3. Personal Collection State
  const [collectionText, setCollectionText] = useState("")
  const [collectionCount, setCollectionCount] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("inducks_collection_issues")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setCollectionText(parsed.map((code) => `${code}^1`).join("\n"))
          setCollectionCount(parsed.length)
        }
      }
    } catch (e) {
      console.error("Failed to load collection", e)
    }
  }, [])

  const handleSaveCollection = () => {
    const issues = collectionText
      .split(/[\n;]+/)
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.includes("^")) {
          const parts = trimmed.split("^");
          if (parts[0]) {
            return parts[0].trim();
          }
        }
        return null;
      })
      .filter((line): line is string => line !== null && line.length > 0)

    localStorage.setItem("inducks_collection_issues", JSON.stringify(issues))
    setCollectionCount(issues.length)
    toast.success(t("collection.saved_success") || "Collection sauvegardée !")
  };

  const themeOptions = [
    { value: "light", icon: Sun, label: t("theme.light") || "Clair" },
    { value: "dark", icon: Moon, label: t("theme.dark") || "Sombre" },
    { value: "system", icon: Monitor, label: t("theme.system") || "Système" },
  ] as const

  const languagesList = [
    { code: "fr", name: "Français (FR)", flag: "https://flagcdn.com/w20/fr.png" },
    { code: "en", name: "English (US)", flag: "https://flagcdn.com/w20/us.png" },
    { code: "de", name: "Deutsch (DE)", flag: "https://flagcdn.com/w20/de.png" },
    { code: "es", name: "Español (ES)", flag: "https://flagcdn.com/w20/es.png" },
    { code: "it", name: "Italiano (IT)", flag: "https://flagcdn.com/w20/it.png" },
    { code: "pt", name: "Português (PT)", flag: "https://flagcdn.com/w20/pt.png" },
  ];
  const currentLang = languagesList.find(l => l.code === i18n.language) || languagesList[1];

  return (
    <div className="w-full max-w-4xl mx-auto p-4 lg:p-8 space-y-8 pb-20">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {t("settings.title") || "Paramètres"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("settings.subtitle") || "Gérez les préférences de l'application et vos sources de données."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Language & Theme */}
        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              {t("settings.general") || "Général"}
            </CardTitle>
            <CardDescription>
              {t("settings.general_desc") || "Langue de l'interface et thème d'affichage."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("settings.language") || "Langue"}</Label>
              <Select value={i18n.language} onValueChange={(lang) => i18n.changeLanguage(lang)}>
                <SelectTrigger className="w-full h-10 border-border-subtle bg-surface/50 rounded-xl hover:bg-surface-2">
                  <div className="flex items-center gap-2">
                    <img 
                      src={currentLang.flag} 
                      className="w-4 h-3 rounded-xs shrink-0 object-cover" 
                      alt="" 
                    />
                    <span>{currentLang.name}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border-subtle bg-surface">
                  {languagesList.map((l) => (
                    <SelectItem key={l.code} value={l.code} className="rounded-lg">
                      <div className="flex items-center gap-2">
                        <img src={l.flag} className="w-4 h-3 rounded-xs shrink-0 object-cover" alt="" />
                        <span>{l.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("settings.theme") || "Thème"}</Label>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map(({ value, icon: Icon, label }) => (
                  <Button
                    key={value}
                    variant={theme === value ? "default" : "outline"}
                    className="h-10 rounded-xl gap-2 font-medium text-xs"
                    onClick={() => setTheme(value as any)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Inducks Cookie */}
        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" />
              {t("settings.inducks_cookie") || "Cookie Inducks"}
            </CardTitle>
            <CardDescription>
              {t("settings.cookie_desc") || "Nécessaire pour charger les images en haute résolution depuis Inducks."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inducks-cookie" className="text-xs font-semibold">
                Cookie (coa-session, etc.)
              </Label>
              <Input
                id="inducks-cookie"
                placeholder="Ex: coa-session=..."
                value={cookieValue}
                onChange={(e) => setCookieValue(e.target.value)}
                className="h-10 border-border-subtle bg-surface/50 rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                {t("settings.cookie_help") ||
                  "Ce cookie permet d'accéder aux images haute résolution. Récupérez-le dans l'inspecteur du navigateur sur inducks.org."}
              </p>
            </div>
            <Button onClick={handleSaveCookie} disabled={isSavingCookie} className="w-full gap-2 rounded-xl">
              {isSavingCookie ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t("common.save") || "Enregistrer"}
            </Button>
          </CardContent>
        </Card>

        {/* Card 4: Local Database */}
        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              {t("localDb.title") || "Base de données Inducks locale"}
            </CardTitle>
            <CardDescription>
              {t("localDb.desc_1") ||
                "Chargez les fichiers .isv extraits de la base de données Inducks officielle pour travailler hors ligne."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed bg-surface-2/60 p-4 rounded-xl border border-border-subtle">
              <p>
                {t("localDb.desc_2") ||
                  "Sélectionnez tous les fichiers .isv extraits du dump officiel. La base sera entièrement stockée en local."}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <a
                  href="https://mega.nz/folder/lSZ3BSIa#5ygCpsBRQrd8JCxvfmMaFg"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("settings.download_isv") || "Télécharger les fichiers ISV (depuis Mega)"}
                </a>
              </div>
            </div>

            {isActiveDb && (
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">
                <p className="font-semibold">{t("localDb.already_imported") || "Base de données active en local."}</p>
                {dbStats && (
                  <p className="mt-1 opacity-90">
                    {t("localDb.imported_stats", { count: dbStats.count, size: formatBytes(dbStats.size) }) ||
                      `${dbStats.count} tables importées (${formatBytes(dbStats.size)})`}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".isv"
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingDb}
                className="w-full gap-2 rounded-xl h-11"
              >
                {isLoadingDb ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {t("localDb.btn_select") || "Sélectionner les fichiers .isv"}
              </Button>
              {isLoadingDb && progressMsg && (
                <p className="text-xs text-center text-muted-foreground animate-pulse font-medium">{progressMsg}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Personal Collection */}
        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              {t("collection.title") || "Ma collection Inducks"}
            </CardTitle>
            <CardDescription>
              {t("collection.description") ||
                "Collez ici la liste de vos numéros possédés (un code par ligne, ex: FR/MP 300)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="flex min-h-[120px] w-full rounded-xl border border-border-subtle bg-surface/50 px-3 py-2 text-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
              placeholder="FR/MP 300&#10;FR/PM 2000&#10;US/WDC 100"
              value={collectionText}
              onChange={(e) => setCollectionText(e.target.value)}
            />
            {collectionCount > 0 && (
              <div className="text-xs text-text-secondary bg-surface-2/60 p-2 rounded-lg border border-border-subtle">
                {t("collection.saved_count", { count: collectionCount }) ||
                  `Vous avez actuellement ${collectionCount} numéros enregistrés.`}
              </div>
            )}
            <Button onClick={handleSaveCollection} className="w-full gap-2 rounded-xl">
              <Save className="w-4 h-4" />
              {t("collection.save") || "Sauvegarder la collection"}
            </Button>
          </CardContent>
        </Card>

        {/* Card 5: Community & Legal Links */}
        <Card className="rounded-2xl border-border-subtle bg-surface shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              {t("settings.links") || "Liens utiles & Communauté"}
            </CardTitle>
            <CardDescription>
              {t("settings.links_desc") || "Rejoignez la communauté Inducks ou contribuez au projet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href="https://discord.gg/trPVaPwDJz"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface/50 hover:bg-surface-2 hover:-translate-y-0.5 active:scale-98 hover:shadow-xs transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#5865F2] shrink-0 group-hover:scale-105 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c3.028 2.2275 6.0194 3.5953 8.9599 4.5079a.0775.0775 0 00.0833-.0277c.7063-.9663 1.324-1.9967 1.8385-3.0867a.0808.0808 0 00-.0441-.1105c-.9583-.3645-1.8726-.8154-2.729-1.336a.0792.0792 0 01-.0078-.1308c.1844-.138.3626-.2822.531-.4306a.0754.0754 0 01.0788-.0105c5.829 2.6719 12.1818 2.6719 17.944 0a.0747.0747 0 01.0794.0095c.1684.1494.3476.2936.532.4316a.0797.0797 0 01-.0075.1308 11.453 11.453 0 01-2.729 1.336.0792.0792 0 00-.044.1105c.5144 1.09 1.132 2.1204 1.8385 3.0867a.077.077 0 00.0833.0277c2.9493-.9126 5.9407-2.2804 8.97-4.5078a.0784.0784 0 00.0311-.056c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.095 2.1568 2.419 0 1.3332-.9555 2.419-2.157 2.419zm7.975 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.095 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
                </svg>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Discord</p>
                  <p className="text-[10px] text-muted-foreground">Discord de Inducks</p>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
            </a>

            <a
              href="https://github.com/WizyxGH/InducksButBetter"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface/50 hover:bg-surface-2 hover:-translate-y-0.5 active:scale-98 hover:shadow-xs transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <Github className="w-5 h-5 text-foreground shrink-0 group-hover:scale-105 transition-transform" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">GitHub</p>
                  <p className="text-[10px] text-muted-foreground">Contribuer au projet</p>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
            </a>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface/50 hover:bg-surface-2 hover:-translate-y-0.5 active:scale-98 hover:shadow-xs transition-all duration-300 group cursor-pointer">
              <div className="flex items-center gap-3 w-full">
                <Scale className="w-5 h-5 text-primary shrink-0 group-hover:scale-105 transition-transform" />
                <div className="space-y-0.5 w-full">
                  <p className="text-xs font-bold text-foreground">{t("legal.title") || "Mentions légales"}</p>
                  <div className="text-[10px] text-muted-foreground">
                    <LegalModal />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
