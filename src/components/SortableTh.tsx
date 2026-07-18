import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SortableThProps {
  col: string
  sortKey: string
  direction: "asc" | "desc" | null
  onSort: (col: string) => void
}

export function SortableTh({ col, sortKey, direction, onSort }: SortableThProps) {
  const isActive = sortKey === col

  return (
    <th
      className="px-6 py-4 font-semibold whitespace-nowrap bg-surface-2 cursor-pointer hover:bg-surface-3 hover:text-primary transition-colors group"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-2">
        {col}
        <span
          className={cn(
            "transition-all duration-200",
            isActive ? "text-primary" : "text-text-hint group-hover:text-text-secondary"
          )}
        >
          {isActive ? (
            direction === "asc" ? (
              <ChevronUp className="w-4 h-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="w-4 h-4 transition-transform duration-200" />
            )
          ) : (
            <ChevronsUpDown className="w-3.5 h-3.5" />
          )}
        </span>
      </div>
    </th>
  )
}
