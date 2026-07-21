import * as React from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { Maximize2, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FlagBadge } from "@/components/FlagBadge"

interface IssueResultCardProps {
  row: any
  onSelect?: (issuecode: string) => void
}

export function IssueResultCard({ row, onSelect }: IssueResultCardProps) {
  const { t, i18n } = useTranslation();
  const [imageError, setImageError] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [row.issuecode]);

  const cleanText = (val: string) => {
    if (!val) return "";
    let clean = val.trim();
    if (clean.startsWith('[') && clean.endsWith(']')) {
      return clean.substring(1, clean.length - 1).trim();
    }
    return clean.replace(/\[.*?\]/g, '').trim();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0000-00-00' || dateStr === '9999-99-99') return t('story.unknown_date');
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;

    const year = parts[0];
    const month = parts[1];
    const day = parts.length > 2 ? parts[2] : '00';

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

  const issueUrl = `https://inducks.org/issue.php?c=${row.issuecode}`;

  const thumbData = React.useMemo(() => {
    if (!row.issue_thumb) return null;
    const parts = row.issue_thumb.split('|');
    const url = parts.length > 1 ? parts[1] : parts[0];

    let baseUrl = url;
    if (!url.startsWith('http')) {
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
  }, [row.issue_thumb]);

  const handleClick = () => {
    if (onSelect) {
      onSelect(row.issuecode);
    } else {
      window.open(issueUrl, "_blank");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <Card
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="group overflow-hidden border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 hover:bg-zinc-50/10 dark:hover:bg-zinc-800/10 transition-all duration-300 rounded-lg bg-white dark:bg-zinc-900 cursor-pointer active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <CardContent className="p-0 flex flex-row">
        {/* Left: Cover Thumbnail */}
        <div
          className="w-[140px] sm:w-[180px] shrink-0 border-r border-zinc-100 dark:border-zinc-700 relative flex items-center justify-center p-1 group/thumb overflow-hidden bg-zinc-50 dark:bg-zinc-800"
        >
          {thumbData && !imageError && !imageLoaded && (
            <div className="absolute inset-1 rounded animate-shimmer" />
          )}
          <img
            src={thumbData && !imageError ? thumbData.preview : ""}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              "max-w-full max-h-full object-contain opacity-90 group-hover/thumb:opacity-100 transition-all duration-500 group-hover/thumb:scale-105",
              (!thumbData || imageError) && "hidden",
              imageLoaded ? "opacity-90" : "opacity-0"
            )}
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />
          {(!thumbData || imageError) && (
            <div className="flex flex-col items-center gap-2 text-zinc-300">
              <BookOpen className="w-8 h-8 opacity-20" />
              <span className="text-[10px] font-bold uppercase tracking-tighter opacity-30">No Cover</span>
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
        <div className="flex-1 flex flex-col min-w-0 p-5 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FlagBadge country={row.countrycode} name={row.countrycode.toUpperCase()} />
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold tracking-wider">
                {row.issuecode}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight mb-1 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
              {cleanText(row.series_title)} #{row.issuenumber}
            </h3>
            {row.issue_title && (
              <p className="text-xs text-muted-foreground italic truncate">
                {cleanText(row.issue_title)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 border-t border-zinc-50 dark:border-zinc-800 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {row.publishername && (
              <div className="col-span-1 sm:col-span-2">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.publisher')} :</span> {row.publishername}
              </div>
            )}
            <div>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.release_date')} :</span> {formatDate(row.oldestdate)}
            </div>
            {row.pages !== null && row.pages > 0 && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.pagination')} :</span> {row.pages} {t('story.pages')}
              </div>
            )}
            {row.price && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.price') || 'Prix'} :</span> {row.price}
              </div>
            )}
            {row.size && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.dimensions') || 'Format'} :</span> {row.size}
              </div>
            )}
            {row.attached && (
              <div className="col-span-1 sm:col-span-2">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.attached') || 'Supplément'} :</span> {row.attached}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
