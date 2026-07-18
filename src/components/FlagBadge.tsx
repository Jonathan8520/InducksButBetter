import { cn } from "@/lib/utils"

interface FlagBadgeProps {
  country: string
  name: string
  className?: string
}

export function FlagBadge({ country, name, className }: FlagBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 bg-surface-2 border border-border-subtle px-1.5 py-0.5 rounded text-[10px] font-medium text-text-secondary",
        className
      )}
    >
      <img
        src={`https://flagcdn.com/w20/${country.toLowerCase()}.png`}
        className="w-3.5 h-2.5 rounded-sm object-cover transition-transform hover:scale-110"
        alt={country}
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <span className="truncate max-w-[100px]">{name}</span>
    </div>
  )
}
