import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SectionTitleProps {
  icon: LucideIcon
  children: React.ReactNode
  className?: string
  iconClassName?: string
}

/** Reusable section header: icon + title text */
export function SectionTitle({ icon: Icon, children, className, iconClassName }: SectionTitleProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon className={cn("w-5 h-5 text-primary", iconClassName)} />
      <h2 className="text-lg font-semibold">{children}</h2>
    </div>
  )
}
