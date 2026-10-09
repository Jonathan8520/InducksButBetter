/** Une bulle de bande dessinée qui cache une loupe : chercher dans les cases. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo-mark">
      <path
        d="M16 3.2C8.9 3.2 3.2 8 3.2 14c0 3.3 1.7 6.2 4.4 8.2L6.2 28.4l6.5-3.5c1.1.3 2.2.4 3.3.4 7.1 0 12.8-4.8 12.8-11.3S23.1 3.2 16 3.2Z"
        fill="var(--marker)"
        stroke="var(--logo-ink, #162447)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="13.4" r="4.4" fill="none" stroke="var(--logo-ink, #162447)" strokeWidth="2.2" />
      <path d="M18.3 16.8l3.4 3.4" stroke="var(--logo-ink, #162447)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <LogoMark />
      {!compact && <span className="logo__word">InducksButBetter</span>}
    </span>
  );
}
