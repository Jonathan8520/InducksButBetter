import * as React from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { Maximize2, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipArrow,
} from "@/components/ui/tooltip"
import { CreatorBadge } from "@/components/CreatorBadge"
import { FlagBadge } from "@/components/FlagBadge"

interface StoryResultCardProps {
  row: any
}

export function StoryResultCard({ row }: StoryResultCardProps) {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [row.storycode]);

  const cleanText = (val: string) => {
    if (!val) return "";
    let clean = val.trim();
    // If it's something like "[Comment]", remove brackets but keep text
    if (clean.startsWith('[') && clean.endsWith(']')) {
      return clean.substring(1, clean.length - 1).trim();
    }
    // Otherwise remove bracketed parts like "[Original Title]" from names
    return clean.replace(/\[.*?\]/g, '').trim();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0000-00-00' || dateStr === '9999-99-99') return t('story.unknown_date');

    // Handle Inducks specific partial dates (YYYY-MM-00 or YYYY-00-00)
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    if (month === '00') return year;

    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, day === '00' ? 1 : parseInt(day));
      if (isNaN(date.getTime())) return dateStr;

      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
      };
      if (day !== '00') options.day = 'numeric';

      return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'fr-FR', options).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  const charactersRaw = row.character_list ? row.character_list.split(';').map((c: string) => {
    const [code, name, appComment, charComment, url] = c.split('|');
    return {
      code,
      name: cleanText(name),
      appComment: cleanText(appComment),
      charComment: cleanText(charComment),
      url: url
    };
  }) : [];

  // Deduplicate by name to avoid "Picsou" appearing twice if multiple codes map to same name
  const characters = charactersRaw.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.name === v.name) === i);

  const publications = row.publication_list ? row.publication_list.split(';').map((p: string) => {
    const [country, name] = p.split('|');
    return { country, name: cleanText(name) };
  }) : [];

  const creatorsRaw = row.creators ? row.creators.split(';') : [];

  const writers = creatorsRaw
    .filter((c: string) => {
      const type = c.split(':')[0].toLowerCase();
      return ['p', 'w', 'pa', 'wa', 'pw'].includes(type) || type.includes('writer') || type.includes('plot');
    })
    .map((c: string) => {
      const parts = c.split(':');
      if (!parts[1]) return null;
      if (parts[1].includes('|')) {
        const [code, name] = parts[1].split('|');
        return { code, name };
      }
      return { code: parts[1], name: parts[1] };
    }).filter(Boolean)
    .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.code === v.code) === i);

  const artists = creatorsRaw
    .filter((c: string) => {
      const type = c.split(':')[0].toLowerCase();
      return ['a', 'i', 'pa', 'wa', 'art'].includes(type) || type.includes('penciller') || type.includes('ink');
    })
    .map((c: string) => {
      const parts = c.split(':');
      if (!parts[1]) return null;
      if (parts[1].includes('|')) {
        const [code, name] = parts[1].split('|');
        return { code, name };
      }
      return { code: parts[1], name: parts[1] };
    }).filter(Boolean)
    .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.code === v.code) === i);

  const text = React.useMemo(() => {
    return (row.full_description || "").trim();
  }, [row.full_description]);

  React.useLayoutEffect(() => {
    if (textRef.current && text) {
      const hasOverflow = textRef.current.scrollHeight > textRef.current.clientHeight;
      setIsTruncated(hasOverflow);
    }
  }, [text]);

  const storyUrl = `https://inducks.org/story.php?c=${row.storycode}`;

  const thumbData = React.useMemo(() => {
    if (!row.story_thumb) return null;

    // Handle both "sitecode|url" and plain "url"
    const parts = row.story_thumb.split('|');
    const url = parts.length > 1 ? parts[1] : parts[0];

    // Outducks site logic
    let baseUrl = url;
    if (!url.startsWith('http')) {
      // If sitecode is webusers and path doesn't start with webusers, prepend it
      // Note: Outducks often uses 'webusers/webusers/' for recent uploads
      if (parts[0] === 'webusers' && !url.startsWith('webusers/')) {
        baseUrl = `https://outducks.org/webusers/webusers/${url}`;
      } else {
        baseUrl = `https://outducks.org/${url.startsWith('/') ? url.substring(1) : url}`;
      }
    }

    return {
      preview: `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=${baseUrl}`)}`,
      full: `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?image=${baseUrl}`)}`
    };
  }, [row.story_thumb]);

  return (
    <Card
      className="group overflow-hidden border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-lg transition-all duration-300 rounded-lg bg-white dark:bg-zinc-900"
    >
      <CardContent className="p-0 flex flex-row">
        {/* Left: Thumbnail */}
        <div
          className="w-[200px] shrink-0 border-r border-zinc-100 dark:border-zinc-700 relative cursor-pointer flex items-center justify-center p-1 group/thumb overflow-hidden bg-zinc-50 dark:bg-zinc-800"
          onClick={() => window.open(storyUrl, "_blank")}
        >
          {/* Shimmer skeleton while image loads */}
          {thumbData && !imageError && !imageLoaded && (
            <div className="absolute inset-1 rounded animate-shimmer" />
          )}
          <img
            src={thumbData && !imageError ? thumbData.preview : ""}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              "max-w-full max-h-full object-contain opacity-90 group-hover/thumb:opacity-100 transition-all duration-500 group-hover/thumb:scale-110",
              (!thumbData || imageError) && "hidden",
              imageLoaded ? "opacity-90" : "opacity-0"
            )}
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />
          {(!thumbData || imageError) && (
            <div className="flex flex-col items-center gap-2 text-zinc-300">
              <BookOpen className="w-8 h-8 opacity-20" />
              <span className="text-[10px] font-bold uppercase tracking-tighter opacity-30">No Image</span>
            </div>
          )}

          {thumbData && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-700 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(thumbData.full, "_blank");
              }}
            >
              <Maximize2 className="w-3.5 h-3.5 text-zinc-600" />
            </Button>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-5 flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => window.open(storyUrl, "_blank")}>
                {row.hero_name && (
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5 block">
                    {cleanText(row.hero_name)}
                  </span>
                )}
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight mb-1 truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                  {cleanText(row.story_title) || t('story.no_title')}
                </h3>
                <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold tracking-wider">
                  {row.storycode}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.pagination')} :</span> {
                  row.entirepages > 0
                    ? row.entirepages
                    : (row.brokenpagenumerator && row.brokenpagedenominator)
                      ? `${row.brokenpagenumerator}/${row.brokenpagedenominator}`
                      : "?"
                } {t('story.pages')} · <span className="text-blue-600/80 font-medium">{t(`kinds.${row.kind}`) || row.kind}</span>
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.release_date')} :</span> {formatDate(row.firstpublicationdate)}
                {row.rowsperpage > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded text-[9px] font-bold uppercase tracking-tight">
                    {row.rowsperpage} {row.rowsperpage > 1 ? t('story.strips') || 'bandes' : t('story.strip') || 'bande'} / page
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 col-span-2">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.publications')} :</span>
                {publications.length > 0 ? (
                  <div className="inline-flex flex-wrap gap-2 ml-1">
                    {publications.slice(0, 3).map((p: any, i: number) => (
                      <FlagBadge key={i} country={p.country} name={p.name} />
                    ))}
                    {publications.length > 3 && <span className="text-[9px] text-zinc-400">+{publications.length - 3}</span>}
                  </div>
                ) : (
                  <span className="ml-1 text-zinc-400 italic">{t('story.none')}</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-zinc-50 dark:border-zinc-800 pt-3">
              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-zinc-500 dark:text-zinc-400 tracking-tighter mr-0.5">{t('story.script')} :</span>
                {writers.length > 0 ? writers.map((w: any, i: number) => (
                  <CreatorBadge key={i} code={w.code} name={w.name} />
                )) : <span className="text-zinc-400">?</span>}
              </div>
              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-zinc-500 dark:text-zinc-400 tracking-tighter mr-0.5">{t('story.art')} :</span>
                {artists.length > 0 ? artists.map((a: any, i: number) => (
                  <CreatorBadge key={i} code={a.code} name={a.name} size="sm" />
                )) : <span className="text-zinc-400">?</span>}
              </div>
            </div>

            {/* Characters section */}
            <div className="flex flex-row flex-wrap gap-2 border-t border-zinc-50 dark:border-zinc-800">
              {characters.slice(0, 15).map((c: any, i: number) => {
                const charImageUrl = c.url
                  ? `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/webusers/${c.url.startsWith('/') ? c.url.substring(1) : c.url}`)}`
                  : `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/characterthumb.php?c=${c.code}`)}`;

                return (
                  <div key={i} className="flex items-center gap-1.5 w-fit group/char">
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-pointer">
                          <div 
                            className="w-4 h-4 rounded-full overflow-hidden border-zinc-200 dark:border-zinc-700 border bg-zinc-100 dark:bg-zinc-800 shrink-0 shadow-sm relative flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://inducks.org/character.php?c=${c.code}`, "_blank");
                            }}
                          >
                            <span className="text-[6px] font-bold text-zinc-400 dark:text-zinc-500 absolute inset-0 flex items-center justify-center uppercase leading-none tracking-tighter">
                              {c.code}
                            </span>
                            <img 
                              src={charImageUrl}
                              alt={c.name}
                              className="w-full h-full object-cover z-10 relative"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                          <span 
                            className="text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-medium whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://inducks.org/character.php?c=${c.code}`, "_blank");
                            }}
                          >
                            {c.name}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px] text-xs leading-relaxed">
                        <div className="flex flex-col gap-0.5">
                          <p className="font-bold">{c.name}</p>
                          {c.charComment && <p className="text-zinc-600 italic leading-snug">{c.charComment}</p>}
                        </div>
                        <TooltipArrow className="fill-popover" />
                      </TooltipContent>
                    </Tooltip>

                    {c.appComment && (
                      <span className="text-[9px] text-zinc-400 italic whitespace-nowrap">
                        ({c.appComment})
                      </span>
                    )}
                  </div>
                );
              })}
              {characters.length > 15 && (
                <span className="text-[10px] text-zinc-400 font-medium pl-1 self-start">
                  +{characters.length - 15}
                </span>
              )}
            </div>
          </div>

          {/* Description Box */}
          {text && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-700 p-4 pt-3 flex flex-col gap-1">
              <div
                ref={textRef}
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical' as any,
                  overflow: 'hidden',
                  WebkitLineClamp: isExpanded ? 'unset' : 2,
                  maxHeight: isExpanded ? '500px' : '3em',
                  transition: 'max-height 0.35s cubic-bezier(0.22,1,0.36,1)',
                }}
                className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 italic"
              >
                {text}
              </div>
              {(isTruncated || isExpanded) && (
                <span
                  className="text-blue-500 font-bold text-[10px] cursor-pointer hover:underline self-end transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  {isExpanded ? t('story.read_less') || 'Moins' : t('story.read_more')}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
