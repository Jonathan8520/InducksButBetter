interface CreatorBadgeProps {
  code: string
  name: string
  size?: "sm" | "md"
}

export function CreatorBadge({ code, name, size = "md" }: CreatorBadgeProps) {
  const avatarSize = size === "sm" ? "w-4 h-4" : "w-5 h-5"
  const photoUrl = `/api/proxy-image?url=${encodeURIComponent(
    `https://inducks.org/creators/photos/${code.replace(/ /g, "_")}.jpg`
  )}`

  return (
    <a
      href={`https://inducks.org/creator.php?c=${code}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 bg-surface border border-border-subtle px-1.5 py-0.5 rounded-md shadow-sm hover:border-blue-300 dark:hover:border-blue-700 hover:bg-surface-2 transition-all"
    >
      <div className={`${avatarSize} rounded-full overflow-hidden border border-border-subtle bg-zinc-100 dark:bg-zinc-800 shrink-0 relative flex items-center justify-center`}>
        <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 absolute inset-0 flex items-center justify-center uppercase">
          {name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2)}
        </span>
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover z-10 relative"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      </div>
      <span className="text-text-secondary font-medium text-[11px]">{name}</span>
    </a>
  )
}
