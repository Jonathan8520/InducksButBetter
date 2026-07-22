import { useState, useEffect, lazy, Suspense } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LocalDbUploader } from "@/components/LocalDbUploader"
import { GoogleAnalytics } from "@/components/GoogleAnalytics"
import { LegalModal } from "@/components/LegalModal"
import { BookOpen, LibraryBig, User, Cat, Database as DbIcon, Loader2, Settings as SettingsIcon, Globe } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import { Toaster } from "sonner"
import { useRouteMetadata } from "@/hooks/useRouteMetadata"

// Lazy load heavy components to code-split the application
const AdvancedSearch = lazy(() => import("@/components/AdvancedSearch").then(module => ({ default: module.AdvancedSearch })))
const SqlEditor = lazy(() => import("@/components/SqlEditor").then(module => ({ default: module.SqlEditor })))
const AiAssistant = lazy(() => import("@/components/AiAssistant").then(module => ({ default: module.AiAssistant })))
const PublicationsSearch = lazy(() => import("@/components/Publications/PublicationsSearch").then(module => ({ default: module.PublicationsSearch })))
const Settings = lazy(() => import("@/components/Settings").then(module => ({ default: module.Settings })))
const AuthorsSearch = lazy(() => import("@/components/Authors/AuthorsSearch").then(module => ({ default: module.AuthorsSearch })))
const CharactersSearch = lazy(() => import("@/components/Characters/CharactersSearch").then(module => ({ default: module.CharactersSearch })))
const CountryPublications = lazy(() => import("@/components/Publications/CountryPublications").then(module => ({ default: module.CountryPublications })))
const PublicationDetail = lazy(() => import("@/components/Publications/PublicationDetail").then(module => ({ default: module.PublicationDetail })))
const IssueDetail = lazy(() => import("@/components/Publications/IssueDetail").then(module => ({ default: module.IssueDetail })))
const StoryDetail = lazy(() => import("@/components/Search/StoryDetail").then(module => ({ default: module.StoryDetail })))

// Reusable loading fallback
const TabFallback = () => (
  <div className="flex w-full h-full min-h-[300px] items-center justify-center text-primary/40">
    <Loader2 className="w-8 h-8 animate-spin" />
  </div>
)

function App() {
  const { i18n, t } = useTranslation();
  useTheme(); // initialise theme from localStorage / system preference
  const [activeTab, setActiveTab] = useState("stories");
  const [prevTab, setPrevTab] = useState("stories");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM inducks_story LIMIT 10");

  const [selectedStorycode, setSelectedStorycode] = useState<string | null>(null);
  const [selectedIssuecode, setSelectedIssuecode] = useState<string | null>(null);
  const [selectedPersoncode, setSelectedPersoncode] = useState<string | null>(null);
  const [selectedCharactercode, setSelectedCharactercode] = useState<string | null>(null);
  const [selectedCountrycode, setSelectedCountrycode] = useState<string | null>(null);
  const [selectedPublicationcode, setSelectedPublicationcode] = useState<string | null>(null);

  // Call route metadata hook to update page title and description
  useRouteMetadata({
    activeTab,
    selectedStorycode,
    selectedIssuecode,
    selectedPersoncode,
    selectedCharactercode,
    selectedCountrycode,
    selectedPublicationcode,
  });

  useEffect(() => {
    const handleUrlRouting = () => {
      const hash = window.location.hash;
      
      // Reset all codes
      setSelectedStorycode(null);
      setSelectedIssuecode(null);
      setSelectedPersoncode(null);
      setSelectedCharactercode(null);
      setSelectedCountrycode(null);
      setSelectedPublicationcode(null);

      if (!hash) {
        setActiveTab("stories");
        return;
      }

      const decodedHash = decodeURIComponent(hash);
      const parts = decodedHash.replace("#/", "").split("/");
      const rootPart = parts[0];

      if (rootPart === "settings") {
        setActiveTab("settings");
      } else if (rootPart === "entries" || rootPart === "stories") {
        setActiveTab("stories");
        if (parts[1] === "story" && parts[2]) {
          const code = parts.slice(2).join("/");
          setSelectedStorycode(code);
        } else if (parts[1] === "issue" && parts[2]) {
          const code = parts.slice(2).join("/");
          const partsArr = code.split("/");
          const restoredCode = partsArr.length >= 3 ? `${partsArr[0]}/${partsArr[1]} ${partsArr.slice(2).join("/")}` : code;
          setSelectedIssuecode(restoredCode);
        }
      } else if (rootPart === "publications") {
        setActiveTab("publications");
        if (parts[1] === "publication" && parts[2]) {
          const code = parts.slice(2).join("/");
          setSelectedPublicationcode(code);
        } else if (parts[1] === "story" && parts[2]) {
          const code = parts.slice(2).join("/");
          setSelectedStorycode(code);
        } else if (parts[1] === "issue" && parts[2]) {
          const code = parts.slice(2).join("/");
          const partsArr = code.split("/");
          const restoredCode = partsArr.length >= 3 ? `${partsArr[0]}/${partsArr[1]} ${partsArr.slice(2).join("/")}` : code;
          setSelectedIssuecode(restoredCode);
        }
      } else if (rootPart === "authors") {
        setActiveTab("authors");
        if (parts[1]) setSelectedPersoncode(parts.slice(1).join("/"));
      } else if (rootPart === "characters") {
        setActiveTab("characters");
        if (parts[1]) setSelectedCharactercode(parts.slice(1).join("/"));
      } else if (rootPart === "countries") {
        setActiveTab("countries");
        if (parts[1]) setSelectedCountrycode(parts.slice(1).join("/"));
      } else if (rootPart === "sql") {
        setActiveTab("sql");
      } else {
        setActiveTab("stories");
      }
    };

    handleUrlRouting();
    window.addEventListener("popstate", handleUrlRouting);
    window.addEventListener("hashchange", handleUrlRouting);
    return () => {
      window.removeEventListener("popstate", handleUrlRouting);
      window.removeEventListener("hashchange", handleUrlRouting);
    };
  }, []);

  const pushHashState = (expectedHash: string) => {
    // Force the path to be the absolute base path to avoid nested relative paths
    const baseUrl = import.meta.env.BASE_URL || "/";
    const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const expectedUrl = `${cleanBase}${expectedHash}`;
    
    // Compare actual URL (path + hash) to avoid duplicate pushState calls
    const currentUrl = window.location.pathname + window.location.hash;
    if (currentUrl !== expectedUrl) {
      window.history.pushState(null, "", expectedUrl);
    }
  };

  useEffect(() => {
    const rootPrefix = activeTab === "stories" ? "entries" : activeTab;
    
    if (activeTab === "settings") {
      pushHashState("#/settings");
    } else if (selectedStorycode) {
      pushHashState(`#/${rootPrefix}/story/${encodeURI(selectedStorycode)}`);
    } else if (selectedIssuecode) {
      // Replace the space with a slash for cleaner URLs
      const displayCode = selectedIssuecode.replace(" ", "/");
      pushHashState(`#/${rootPrefix}/issue/${encodeURI(displayCode)}`);
    } else if (selectedPersoncode) {
      pushHashState(`#/authors/${encodeURI(selectedPersoncode)}`);
    } else if (selectedCharactercode) {
      pushHashState(`#/characters/${encodeURI(selectedCharactercode)}`);
    } else if (selectedCountrycode) {
      pushHashState(`#/countries/${encodeURI(selectedCountrycode)}`);
    } else if (selectedPublicationcode) {
      pushHashState(`#/publications/publication/${encodeURI(selectedPublicationcode)}`);
    } else {
      pushHashState(`#/${rootPrefix}`);
    }
  }, [
    activeTab, 
    selectedStorycode, 
    selectedIssuecode, 
    selectedPersoncode, 
    selectedCharactercode, 
    selectedCountrycode, 
    selectedPublicationcode
  ]);

  /**
   * Ouvre la fiche d'un personnage, depuis n'importe quel onglet.
   *
   * On efface les autres sélections : sans cela, l'onglet Personnages afficherait bien le
   * personnage mais l'histoire d'origine resterait mémorisée, et un simple changement
   * d'onglet y ramènerait sans prévenir.
   */
  const openCharacter = (code: string) => {
    setSelectedStorycode(null);
    setSelectedIssuecode(null);
    setSelectedPublicationcode(null);
    setSelectedCharactercode(code);
    setActiveTab("characters");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedStorycode(null);
    setSelectedIssuecode(null);
    setSelectedPersoncode(null);
    setSelectedCharactercode(null);
    setSelectedCountrycode(null);
    setSelectedPublicationcode(null);
  };

  return (
    <TooltipProvider>
      <GoogleAnalytics activeTab={activeTab} />
      <div id="main-content" className="h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground">
        <div className="flex flex-col h-screen shrink-0">
          {/* Main Header */}
        <header className="px-4 lg:px-12 py-4 shrink-0 border-b border-border-subtle bg-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <svg className="text-zinc-900 dark:text-white" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M10.5563 5.02523C10.3828 5.19867 10.65 5.77054 11.1516 6.29554C12.1781 7.36898 13.9969 8.48929 15.6375 9.06117C15.8953 9.15023 16.5 9.32367 16.9875 9.44085C18.9938 9.93773 20.7984 10.6502 21.3375 11.1612C21.7078 11.508 21.5438 11.7471 20.2031 12.8065C19.4813 13.3784 19.05 13.8002 18.9141 14.0627C18.8063 14.269 18.8063 14.6674 18.9094 14.9534C18.9516 15.0705 19.1063 15.3705 19.2516 15.6237C19.8234 16.6268 19.8844 17.2315 19.4578 17.5924C19.0828 17.9065 18.3703 17.9346 17.3766 17.6768C16.5281 17.4565 15.8344 17.4846 14.9953 17.7705C14.6109 17.9018 14.0203 18.1971 13.6875 18.4221C13.3734 18.633 12.6891 18.9799 12.2016 19.1768C11.0344 19.6409 10.2469 19.5987 9.02344 19.008C6.51094 17.794 3.87188 14.3112 2.68125 10.6409C2.3625 9.65179 2.24063 9.0846 1.98281 7.34554C1.86094 6.52992 1.74844 5.88304 1.72969 5.91585C1.6875 6.00023 1.59375 8.09554 1.59375 8.93929C1.59375 10.5143 1.91719 11.9018 2.61094 13.2893C3.27188 14.6018 4.0875 15.6705 5.57813 17.1612C7.71563 19.3034 9.45938 20.4752 11.0391 20.8362C11.3531 20.9065 11.9859 20.9393 12.3656 20.9018C13.1297 20.8221 13.7484 20.5784 14.6297 19.9924C15.2063 19.608 15.4406 19.5049 16.125 19.3268C16.6688 19.1862 17.6906 19.1252 18.0938 19.219C18.5438 19.3174 19.5188 19.3315 19.9641 19.2518C20.8594 19.0784 21.4453 18.6237 21.5625 18.0096C21.6328 17.6252 21.5531 17.2924 21.2438 16.6877C20.8031 15.8393 20.7281 15.4596 20.8969 15.0096C21.0375 14.644 21.2531 14.3674 22.0312 13.5705C22.9078 12.6705 23.0719 12.4502 23.1 12.1174C23.1141 11.9252 23.0953 11.8268 23.0016 11.644C22.8609 11.3627 22.1391 10.5424 21.7688 10.2424C20.9109 9.54398 19.3031 8.7846 17.5781 8.25492C16.6125 7.96429 16.4344 7.89867 15.6797 7.59398C14.3484 7.0596 13.0922 6.37992 12.1875 5.71429C11.4141 5.1471 10.725 4.85648 10.5563 5.02523Z" />
                </svg>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {t('header.title')}
                </h1>
              </div>
              <p className="text-muted-foreground text-sm">
                {t('header.subtitle')}
              </p>
            </div>

            <div className="flex flex-row items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (activeTab === "settings") {
                    setActiveTab(prevTab);
                  } else {
                    setPrevTab(activeTab);
                    setActiveTab("settings");
                  }
                }}
                className={cn(
                  "h-10 w-10 text-text-secondary hover:text-text-body hover:bg-surface-2 rounded-xl transition-all border border-transparent",
                  activeTab === "settings" && "border-border-subtle bg-surface-2 text-primary"
                )}
                title={t("settings.title") || "Paramètres"}
              >
                <SettingsIcon className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          {activeTab !== "settings" && (
            <div className="px-4 lg:px-12 shrink-0 flex w-full bg-surface border-b border-border-subtle py-2">
              <TabsList className="bg-surface-2/90 gap-1 h-12 p-1.5 rounded-2xl border border-border-subtle shadow-inner w-full flex justify-between items-center overflow-x-auto overflow-y-hidden">
                <TabsTrigger
                  value="stories"
                  className="data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium transition-all flex-1"
                >
                  <BookOpen className={cn("w-4 h-4 shrink-0", activeTab === "stories" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.stories')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="publications"
                  className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
                >
                  <LibraryBig className={cn("w-4 h-4 shrink-0", activeTab === "publications" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.publications')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="authors"
                  className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
                >
                  <User className={cn("w-4 h-4 shrink-0", activeTab === "authors" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.authors')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="characters"
                  className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
                >
                  <Cat className={cn("w-4 h-4 shrink-0", activeTab === "characters" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.characters')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="sql"
                  className="rounded-xl px-2 sm:px-6 py-2 flex gap-1.5 sm:gap-2 items-center justify-center text-xs sm:text-sm font-medium opacity-60 hover:opacity-100 data-[state=active]:opacity-100 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex-1"
                >
                  <DbIcon className={cn("w-4 h-4 shrink-0", activeTab === "sql" ? "block" : "hidden sm:block")} /> <span className="truncate">{t('tabs.sql')}</span>
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          {/* Content Viewport */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <TabsContent value="stories" className="h-full m-0 p-0 border-none outline-none overflow-y-auto overscroll-contain">
              <Suspense fallback={<TabFallback />}>
                <AdvancedSearch
                  selectedStorycode={selectedStorycode}
                  setSelectedStorycode={setSelectedStorycode}
                  selectedIssuecode={selectedIssuecode}
                  setSelectedIssuecode={setSelectedIssuecode}
                  onOpenCharacter={openCharacter}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="sql" className="h-full m-0 p-0 border-none outline-none bg-surface overflow-auto">
              <div className="p-4 lg:px-12">
                <Suspense fallback={<TabFallback />}>
                  <SqlEditor query={sqlQuery} setQuery={setSqlQuery} />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="publications" className="h-full m-0 p-0 border-none outline-none overflow-y-auto overscroll-contain">
              <Suspense fallback={<TabFallback />}>
                {/* L'histoire passe AVANT le numéro : le ternaire testait selectedIssuecode
                    en premier, si bien qu'ouvrir une histoire depuis le sommaire d'un numéro
                    posait bien le storycode mais laissait IssueDetail affiché. Il fallait
                    cliquer « retour » pour que l'histoire apparaisse enfin. */}
                {selectedStorycode ? (
                  <StoryDetail
                    storycode={selectedStorycode}
                    onBack={() => setSelectedStorycode(null)}
                    onSelectIssue={(code) => {
                      setSelectedStorycode(null);
                      setSelectedIssuecode(code);
                    }}
                    onSelectCharacter={(code) => openCharacter(code)}
                  />
                ) : selectedIssuecode ? (
                  <IssueDetail
                    issuecode={selectedIssuecode}
                    onBack={() => setSelectedIssuecode(null)}
                    onSelectStory={(code) => setSelectedStorycode(code)}
                  />
                ) : selectedPublicationcode ? (
                  <PublicationDetail
                    publicationcode={selectedPublicationcode}
                    onBack={() => setSelectedPublicationcode(null)}
                    onSelectIssue={(code) => setSelectedIssuecode(code)}
                  />
                ) : selectedCountrycode ? (
                  <CountryPublications
                    countrycode={selectedCountrycode}
                    onBack={() => setSelectedCountrycode(null)}
                    onSelectPublication={(code) => {
                      setSelectedPublicationcode(code);
                    }}
                  />
                ) : (
                  <PublicationsSearch
                    selectedStorycode={selectedStorycode}
                    setSelectedStorycode={setSelectedStorycode}
                    selectedIssuecode={selectedIssuecode}
                    setSelectedIssuecode={setSelectedIssuecode}
                    setSelectedCountrycode={setSelectedCountrycode}
                  />
                )}
              </Suspense>
            </TabsContent>

            <TabsContent value="authors" className="h-full m-0 p-0 border-none outline-none overflow-y-auto overscroll-contain">
              <Suspense fallback={<TabFallback />}>
                <AuthorsSearch
                  selectedAuthorcode={selectedPersoncode}
                  setSelectedAuthorcode={setSelectedPersoncode}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="characters" className="h-full m-0 p-0 border-none outline-none overflow-y-auto overscroll-contain">
              <Suspense fallback={<TabFallback />}>
                <CharactersSearch
                  selectedCharactercode={selectedCharactercode}
                  setSelectedCharactercode={setSelectedCharactercode}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="settings" className="h-full m-0 p-0 border-none outline-none overflow-auto bg-surface-2/40">
              <Suspense fallback={<TabFallback />}>
                <Settings />
              </Suspense>
            </TabsContent>
          </div>
        </Tabs>
          {activeTab === "sql" && (
            <Suspense fallback={null}>
              <AiAssistant onCopyToEditor={(q) => setSqlQuery(q)} />
            </Suspense>
          )}
        </div>
        
        {/* Global Footer for legal mentions (temporairement caché)
        <footer className="px-4 py-4 shrink-0 border-t border-border-subtle bg-surface flex justify-center items-center text-xs text-text-hint">
          <LegalModal />
        </footer>
        */}
      </div>
      <Toaster position="top-center" richColors />
    </TooltipProvider>
  )
}

export default App

