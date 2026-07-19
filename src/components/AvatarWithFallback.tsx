import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarWithFallbackProps {
  src: string
  name: string
  alt?: string
  className?: string
  sizeClasses?: string
  textClasses?: string
}

export function AvatarWithFallback({
  src,
  name,
  alt = "",
  className,
  sizeClasses = "w-8 h-8",
  textClasses = "text-[12px]"
}: AvatarWithFallbackProps) {
  // Extract initials (up to 2 letters)
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div 
      className={cn(
        "rounded-full overflow-hidden border border-border-subtle bg-zinc-100 dark:bg-zinc-800 shrink-0 relative flex items-center justify-center",
        sizeClasses,
        className
      )}
    >
      {/* Fallback initials */}
      <span className={cn("font-bold text-zinc-400 dark:text-zinc-500 absolute inset-0 flex items-center justify-center", textClasses)}>
        {initials}
      </span>
      
      {/* Image (hides fallback when loaded successfully) */}
      <img 
        src={src} 
        alt={alt || name} 
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover z-10 relative"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    </div>
  )
}
