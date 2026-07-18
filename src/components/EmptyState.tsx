import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 bg-surface-2 rounded-2xl border-2 border-dashed border-border text-center px-6 gap-3",
        className
      )}
    >
      <Icon className="w-10 h-10 text-text-hint" />
      <p className="text-text-secondary font-medium">{title}</p>
      {description && <p className="text-xs text-text-hint">{description}</p>}
    </div>
  )
}
