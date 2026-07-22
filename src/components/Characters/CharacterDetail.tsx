import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, Calendar, Star, BookOpen, Users, Cat, Globe, User } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CharacterDetailData {
  charactercode: string;
  charactername: string;
  official?: string;
  onetime?: string;
  heroonly?: string;
  charactercomment?: string;
}

interface CharName {
  languagecode: string;
  charactername: string;
  preferred: string;
}

interface CreatorStat {
  personcode: string;
  fullname: string;
  total: number;
  yearrange: string;
}

interface CoCharacter {
  cocharactercode: string;
  cocharactername: string;
  total: number;
  yearrange: string;
}

interface CharacterDetailProps {
  charactercode: string;
  onSelectStory?: (code: string) => void;
}

export default function CharacterDetail({ charactercode, onSelectStory }: CharacterDetailProps) {
  const { t, i18n } = useTranslation();
  const [character, setCharacter] = useState<CharacterDetailData | null>(null);
  const [names, setNames] = useState<CharName[]>([]);
  const [urls, setUrls] = useState<any[]>([]);
  const [creators, setCreators] = useState<CreatorStat[]>([]);
  const [coCharacters, setCoCharacters] = useState<CoCharacter[]>([]);
  const [firstAppearance, setFirstAppearance] = useState<any | null>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const currentLang = i18n.language || "fr";
      try {
        // 1. Fetch character general info
        const charResult = await executeQuery({
          sql: `SELECT charactercode, charactername, official, onetime, heroonly, charactercomment 
                FROM inducks_character WHERE charactercode = ?`,
          args: [charactercode],
        });

        if (charResult.rows.length > 0) {
          setCharacter(charResult.rows[0] as CharacterDetailData);

          // 2. Fetch all translated names
          const namesResult = await executeQuery({
            sql: `SELECT languagecode, charactername, preferred 
                  FROM inducks_charactername 
                  WHERE charactercode = ? AND charactername != ''
                  ORDER BY preferred DESC, languagecode ASC`,
            args: [charactercode],
          });
          setNames(namesResult.rows as CharName[]);

          // 3. Fetch links
          const urlsResult = await executeQuery({
            sql: `SELECT sitecode, url FROM inducks_characterurl WHERE charactercode = ?`,
            args: [charactercode],
          });
          setUrls(urlsResult.rows);

          // 4. Fetch main creators
          const creatorsResult = await executeQuery({
            sql: `SELECT sc.personcode, sc.total, sc.yearrange, p.fullname
                  FROM inducks_statpersoncharacter sc
                  JOIN inducks_person p ON sc.personcode = p.personcode
                  WHERE sc.charactercode = ?
                  ORDER BY sc.total DESC
                  LIMIT 5`,
            args: [charactercode],
          });
          setCreators(creatorsResult.rows as CreatorStat[]);

          // 5. Fetch co-appearing characters
          const coCharResult = await executeQuery({
            sql: `SELECT scc.cocharactercode, scc.total, scc.yearrange, COALESCE(cn.charactername, c.charactername) as cocharactername
                  FROM inducks_statcharactercharacter scc
                  JOIN inducks_character c ON scc.cocharactercode = c.charactercode
                  LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ?
                  WHERE scc.charactercode = ?
                  ORDER BY scc.total DESC
                  LIMIT 5`,
            args: [currentLang, charactercode],
          });
          setCoCharacters(coCharResult.rows as CoCharacter[]);

          // 6. Fetch first appearance story
          const firstAppResult = await executeQuery({
            // character_stories est groupée par (personnage, date) : la première apparition
            // est littéralement la première ligne. La forme précédente joignait
            // inducks_appearance -> storyversion -> story puis triait — soit, pour Donald
            // Duck, un parcours de ses 245 557 apparitions pour en garder une.
            sql: `SELECT storycode, story_title as title, firstpublicationdate
                  FROM character_stories
                  WHERE charactercode = ? AND firstpublicationdate != ''
                  ORDER BY firstpublicationdate ASC
                  LIMIT 1`,
            args: [charactercode],
          });
          if (firstAppResult.rows.length > 0) {
            setFirstAppearance(firstAppResult.rows[0]);
          }

          // 7. Fetch stories
          const storiesResult = await executeQuery({
            // Même table, parcourue à l'envers : les 30 plus récentes sont les 30 dernières
            // lignes. Le décompte d'apparitions est déjà agrégé, ce qui supprime la
            // sous-requête corrélée qui s'exécutait pour chaque ligne affichée.
            sql: `SELECT storycode, story_title, firstpublicationdate, appearances
                  FROM character_stories
                  WHERE charactercode = ?
                  ORDER BY firstpublicationdate DESC
                  LIMIT 30`,
            args: [charactercode],
          });
          setStories(storiesResult.rows as any[]);
        }
      } catch (error) {
        console.error("Error fetching character details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [charactercode, i18n.language]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{t("characters.no_description") || "Aucun détail disponible pour ce personnage."}</p>
      </div>
    );
  }

  // Get current language name or English name
  const currentLangCode = i18n.language || "fr";
  const localizedNameObj = names.find((n) => n.languagecode === currentLangCode) || names.find((n) => n.languagecode === "en");
  const displayName = localizedNameObj ? localizedNameObj.charactername : character.charactername;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between bg-surface-2/30 border border-border-subtle p-6 rounded-3xl">
        <div className="space-y-3 min-w-0">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h2>
              <div className="flex gap-1">
                {character.heroonly === "Y" && (
                  <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black text-[10px] rounded-lg">Héros principal</Badge>
                )}
                {character.official === "Y" && (
                  <Badge variant="secondary" className="text-[10px] rounded-lg">Officiel</Badge>
                )}
                {character.onetime === "Y" && (
                  <Badge variant="outline" className="text-[10px] rounded-lg">Unique</Badge>
                )}
              </div>
            </div>
            {character.charactername && character.charactername !== displayName && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Original:</span> {character.charactername}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground font-mono">{character.charactercode}</p>
          </div>

          {character.charactercomment && (
            <p className="text-xs text-text-secondary italic max-w-2xl leading-relaxed">
              "{character.charactercomment}"
            </p>
          )}

          {firstAppearance && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span>
                {t("characters.first_appearance") || "Première apparition"}:{" "}
                <span
                  onClick={() => {
                    if (onSelectStory) {
                      onSelectStory(firstAppearance.storycode);
                    } else {
                      window.location.hash = `#/entries/story/${encodeURIComponent(firstAppearance.storycode)}`;
                    }
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  {firstAppearance.title || "Sans titre"} ({firstAppearance.firstpublicationdate})
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: International names & Links */}
        <div className="lg:col-span-1 space-y-6">
          {/* International Names */}
          {names.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  Noms internationaux
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-[300px] overflow-y-auto text-xs">
                {names.map((n, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-border-subtle/30 last:border-b-0">
                    <span className="font-bold text-muted-foreground uppercase">{n.languagecode}</span>
                    <span className="font-semibold text-foreground">{n.charactername}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Links */}
          {urls.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {t("authors.links") || "Liens externes"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {urls.map((u, idx) => (
                  <a
                    key={idx}
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border-subtle bg-surface-2/30 hover:bg-surface-2 text-xs font-medium text-text-secondary hover:text-foreground transition-all group"
                  >
                    <span className="truncate max-w-[150px]">{u.sitecode}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Middle/Right columns: Main creators, Companions & Stories */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Main Creators */}
            {creators.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    {t("characters.creators") || "Créateurs principaux"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {creators.map((c) => (
                    <div key={c.personcode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{c.fullname}</p>
                        <p className="text-[10px] text-muted-foreground">{c.yearrange}</p>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {c.total}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Frequent companions */}
            {coCharacters.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {t("characters.co_characters") || "Compagnons fréquents"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {coCharacters.map((cc) => (
                    <div key={cc.cocharactercode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{cc.cocharactername}</p>
                        <p className="text-[10px] text-muted-foreground">{cc.yearrange}</p>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {cc.total}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Stories List */}
          {stories.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {t("characters.stories_featuring", { name: displayName }) || `Histoires avec ${displayName}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {stories.map((story) => (
                  <div
                    key={story.storycode}
                    onClick={() => {
                      if (onSelectStory) {
                        onSelectStory(story.storycode);
                      } else {
                        window.location.hash = `#/entries/story/${encodeURIComponent(story.storycode)}`;
                      }
                    }}
                    className="p-3.5 rounded-xl bg-surface-2/30 border border-border-subtle hover:bg-surface-2 hover:border-primary/20 cursor-pointer transition-all flex justify-between items-center gap-4 group"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-foreground text-xs truncate group-hover:text-primary transition-colors">
                        {story.story_title || "Sans titre"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">{story.storycode}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{story.firstpublicationdate}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
