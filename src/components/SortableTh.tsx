import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SortableThProps {
  col: string
  sortKey: string
  direction: "asc" | "desc" | null
  onSort: (key: string) => void
  onHide?: (key: string) => void
  onDragStart?: (e: React.DragEvent<HTMLTableCellElement>, key: string) => void
  onDragOver?: (e: React.DragEvent<HTMLTableCellElement>) => void
  onDrop?: (e: React.DragEvent<HTMLTableCellElement>, key: string) => void
}

export function SortableTh({ 
  col, 
  sortKey, 
  direction, 
  onSort, 
  onHide,
  onDragStart,
  onDragOver,
  onDrop
}: SortableThProps) {
  const isActive = sortKey === col

  return (
    <th
      className="px-6 py-4 cursor-pointer hover:bg-surface-2 transition-colors border-x border-border-subtle/50 group select-none"
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart && onDragStart(e, col)}
      onDragOver={(e) => onDragOver && onDragOver(e)}
      onDrop={(e) => onDrop && onDrop(e, col)}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {col}
          <span className="text-text-hint">
            {isActive && direction === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5 text-primary" />
            ) : isActive && direction === "desc" ? (
              <ArrowDown className="w-3.5 h-3.5 text-primary" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
            )}
          </span>
        </div>
        {onHide && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onHide(col)
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-3 rounded-md transition-all text-text-hint hover:text-destructive"
            title="Masquer la colonne"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </th>
  )
}
