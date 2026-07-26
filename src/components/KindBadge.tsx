import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface KindBadgeProps {
  kind: string;
  className?: string;
}

export function KindBadge({ kind, className }: KindBadgeProps) {
  const { t } = useTranslation();
  const kindCode = kind ? kind.trim() : "s";
  const rawLabel = t(`kinds.${kindCode}`, { defaultValue: kindCode });
  const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase() : "";

  // Color mapping based on kind code
  let colorClasses = "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/10 dark:border-zinc-500/20";

  switch (kindCode) {
    case "s":
    case "n":
    case "k":
      // Story / Strip
      colorClasses = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/10 dark:border-blue-500/20";
      break;
    case "c":
      // Cover
      colorClasses = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/10 dark:border-purple-500/20";
      break;
    case "i":
      // Illustration
      colorClasses = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/10 dark:border-emerald-500/20";
      break;
    case "a":
      // Article
      colorClasses = "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/10 dark:border-amber-500/20";
      break;
    case "p":
      // Poster
      colorClasses = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/10 dark:border-rose-500/20";
      break;
    case "P":
    case "L":
      // Painting
      colorClasses = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/10 dark:border-indigo-500/20";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold tracking-wider border shrink-0 leading-none",
        colorClasses,
        className
      )}
    >
      {label}
    </span>
  );
}
