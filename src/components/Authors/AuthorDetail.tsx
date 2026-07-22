import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, Calendar, MapPin, Award, BookOpen, Users, Cat, Globe } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AuthorDetailData {
  personcode: string;
  fullname: string;
  nationalitycountrycode?: string;
  numberofindexedissues?: number;
  birthname?: string;
  borndate?: string;
  bornplace?: string;
  deceaseddate?: string;
  deceasedplace?: string;
  education?: string;
  comicstext?: string;
  othertext?: string;
}

interface CoAuthor {
  copersoncode: string;
  fullname: string;
  total: number;
  yearrange: string;
}

interface FavCharacter {
  charactercode: string;
  charactername: string;
  total: number;
  yearrange: string;
}

interface AuthorDetailProps {
  personcode: string;
  onSelectStory?: (code: string) => void;
}

export default function AuthorDetail({ personcode, onSelectStory }: AuthorDetailProps) {
  const { t, i18n } = useTranslation();
  const [author, setAuthor] = useState<AuthorDetailData | null>(null);
  const [aliases, setAliases] = useState<any[]>([]);
  const [urls, setUrls] = useState<any[]>([]);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [favCharacters, setFavCharacters] = useState<FavCharacter[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const currentLang = i18n.language || "fr";
      try {
        // 1. Fetch author details
        const authorResult = await executeQuery({
          sql: `SELECT p.personcode, p.fullname, p.nationalitycountrycode, p.numberofindexedissues, 
                       p.birthname, p.borndate, p.bornplace, p.deceaseddate, p.deceasedplace, 
                       p.education, p.comicstext, p.othertext
                FROM inducks_person p
                WHERE p.personcode = ?`,
          args: [personcode],
        });

        if (authorResult.rows.length > 0) {
          setAuthor(authorResult.rows[0] as AuthorDetailData);

          // 2. Fetch aliases
          const aliasesResult = await executeQuery({
            sql: `SELECT surname, givenname, official FROM inducks_personalias WHERE personcode = ?`,
            args: [personcode],
          });
          setAliases(aliasesResult.rows);

          // 3. Fetch urls
          const urlsResult = await executeQuery({
            sql: `SELECT sitecode, url FROM inducks_personurl WHERE personcode = ?`,
            args: [personcode],
          });
          setUrls(urlsResult.rows);

          // 4. Fetch co-authors
          const coAuthorsResult = await executeQuery({
            sql: `SELECT sp.copersoncode, sp.total, sp.yearrange, p.fullname
                  FROM inducks_statpersonperson sp
                  JOIN inducks_person p ON sp.copersoncode = p.personcode
                  WHERE sp.personcode = ?
                  ORDER BY sp.total DESC
                  LIMIT 5`,
            args: [personcode],
          });
          setCoAuthors(coAuthorsResult.rows as CoAuthor[]);

          // 5. Fetch favorite characters
          const favCharResult = await executeQuery({
            sql: `SELECT sc.charactercode, sc.total, sc.yearrange, COALESCE(cn.charactername, c.charactername) as charactername
                  FROM inducks_statpersoncharacter sc
                  JOIN inducks_character c ON sc.charactercode = c.charactercode
                  LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ?
                  WHERE sc.personcode = ?
                  ORDER BY sc.total DESC
                  LIMIT 5`,
            args: [currentLang, personcode],
          });
          setFavCharacters(favCharResult.rows as FavCharacter[]);

          // 6. Fetch stories
          const storiesResult = await executeQuery({
            sql: `SELECT DISTINCT s.storycode, s.title as story_title, COUNT(*) as appearances
                  FROM inducks_storyjob sj
                  JOIN inducks_storyversion sv ON sj.storyversioncode = sv.storyversioncode
                  JOIN inducks_story s ON sv.storycode = s.storycode
                  WHERE sj.personcode = ?
                  GROUP BY s.storycode
                  ORDER BY appearances DESC
                  LIMIT 20`,
            args: [personcode],
          });
          setStories(storiesResult.rows as any[]);
        }
      } catch (error) {
        console.error("Error fetching author details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [personcode, i18n.language]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!author) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{t("authors.no_description")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between bg-surface-2/30 border border-border-subtle p-6 rounded-3xl">
        <div className="space-y-3 min-w-0">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{author.fullname}</h2>
            {author.birthname && author.birthname !== author.fullname && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{t("authors.birth_name") || "Nom de naissance"}:</span> {author.birthname}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground font-mono">{author.personcode}</p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            {author.borndate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>
                  {t("authors.born") || "Né(e)"} {author.borndate}
                  {author.bornplace && ` ${t("authors.place_in") || "à"} ${author.bornplace}`}
                </span>
              </div>
            )}
            {author.deceaseddate && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  {t("authors.deceased") || "Décédé(e)"} {author.deceaseddate}
                  {author.deceasedplace && ` ${t("authors.place_in") || "à"} ${author.deceasedplace}`}
                </span>
              </div>
            )}
          </div>

          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                {t("authors.aliases") || "Alias"}:
              </span>
              {aliases.map((alias, idx) => (
                <Badge key={idx} variant={alias.official === "Y" ? "default" : "outline"} className="text-[10px] rounded-lg">
                  {alias.givenname} {alias.surname}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-start md:items-end shrink-0 text-left md:text-right space-y-1 bg-surface/85 p-4 rounded-2xl border border-border-subtle shadow-sm w-full md:w-auto">
          <p className="text-xs font-semibold text-muted-foreground">{t("authors.number_of_stories")}</p>
          <p className="text-3xl font-extrabold text-primary">{author.numberofindexedissues || 0}</p>
          {author.nationalitycountrycode && (
            <Badge variant="secondary" className="mt-2 text-xs font-medium rounded-lg">
              {author.nationalitycountrycode.toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Bio & URLs */}
        <div className="lg:col-span-1 space-y-6">
          {/* Biography Text if present */}
          {(author.comicstext || author.othertext || author.education) && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  {t("authors.biography") || "Biographie"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs leading-relaxed text-text-secondary">
                {author.education && (
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">Éducation:</span>
                    <p>{author.education}</p>
                  </div>
                )}
                {author.comicstext && (
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">Comics:</span>
                    <p>{author.comicstext}</p>
                  </div>
                )}
                {author.othertext && (
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">Autre:</span>
                    <p>{author.othertext}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Links / URLs */}
          {urls.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {t("authors.links") || "Liens externs"}
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

        {/* Middle/Right columns: Co-authors, favorite characters & stories */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Co-Authors */}
            {coAuthors.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {t("authors.coauthors") || "Co-auteurs fréquents"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {coAuthors.map((coa) => (
                    <div key={coa.copersoncode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{coa.fullname}</p>
                        <p className="text-[10px] text-muted-foreground">{coa.yearrange}</p>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {coa.total}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Favorite Characters */}
            {favCharacters.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Cat className="w-4 h-4 text-primary" />
                    {t("authors.favorite_characters") || "Personnages fréquents"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {favCharacters.map((char) => (
                    <div key={char.charactercode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{char.charactername}</p>
                        <p className="text-[10px] text-muted-foreground">{char.yearrange}</p>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {char.total}
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
                  {t("authors.stories") || "Histoires"}
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
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {story.appearances} {story.appearances > 1 ? "versions" : "version"}
                    </Badge>
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
