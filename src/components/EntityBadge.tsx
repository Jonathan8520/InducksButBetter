import React from "react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipArrow } from "@/components/ui/tooltip"

interface EntityBadgeProps {
  type: "character" | "creator"
  code: string
  name: string
  url?: string
  appComment?: string
  charComment?: string
  size?: "sm" | "md"
  onSelect?: (code: string, name: string) => void
}

export function EntityBadge({
  type,
  code,
  name,
  url,
  appComment,
  charComment,
  size = "md",
  onSelect,
}: EntityBadgeProps) {
  const isCharacter = type === "character"
  const hasCookie = React.useMemo(() => !!localStorage.getItem("inducks_cookie"), [])

  const avatarSize = size === "sm" ? "w-4 h-4" : "w-5 h-5"
  const tooltipAvatarSize = "w-12 h-12"

  let photoUrl = ""
  if (isCharacter) {
    photoUrl = url
      ? `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/webusers/${url.startsWith('/') ? url.substring(1) : url}`)}`
      : `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/characterthumb.php?c=${code}`)}`
  } else {
    photoUrl = `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/creators/photos/${code.replace(/ /g, "_")}.jpg`)}`
  }

  const href = isCharacter ? `#/characters/${code}` : `#/authors/${code}`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSelect) {
      e.preventDefault()
      onSelect(code, name)
    }
  }

  const avatarFallback = isCharacter ? code : name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2)

  const renderAvatar = (className: string, textSize: string) => (
    <div className={`${className} rounded-full overflow-hidden border border-border-subtle bg-surface-2 shrink-0 relative flex items-center justify-center`}>
      <span className={`${textSize} font-bold text-text-secondary absolute inset-0 flex items-center justify-center uppercase leading-none tracking-tighter`}>
        {avatarFallback}
      </span>
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover z-10 relative"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
    </div>
  )

  return (
    <div className="flex items-center gap-1.5 w-fit group/entity">
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <a
            href={href}
            onClick={handleClick}
            className="flex items-center gap-1.5 hover:bg-surface-2 p-1 -m-1 rounded-md transition-colors cursor-pointer"
          >
            {hasCookie && renderAvatar(avatarSize, size === "sm" ? "text-[6px]" : "text-[8px]")}
            <span className={`${size === "sm" ? "text-[10px]" : "text-xs"} text-primary hover:underline font-medium whitespace-nowrap`}>
              {name}
            </span>
          </a>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px] text-xs leading-relaxed p-3">
          <div className="flex gap-3 items-start">
            {hasCookie && renderAvatar(tooltipAvatarSize, "text-[16px]")}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1 pt-0.5">
              <p className="font-bold text-foreground">
                {name}
                <span className="ml-1 text-[10px] text-muted-foreground font-mono">({code})</span>
              </p>
              {charComment && <p className="text-muted-foreground italic leading-snug">{charComment}</p>}
            </div>
          </div>
          <TooltipArrow className="fill-popover" />
        </TooltipContent>
      </Tooltip>
      {appComment && (
        <span className="text-[10px] text-muted-foreground italic whitespace-nowrap">
          ({appComment})
        </span>
      )}
    </div>
  )
}
