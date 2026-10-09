import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../lib/format";

/** Onglets à indicateur glissant. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
  label: string;
}) {
  const id = useId();
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            className={`tabs__item${active ? " is-active" : ""}`}
            onClick={() => onChange(it.value)}
          >
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="tabs__indicator"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="tabs__label">{it.label}</span>
            {typeof it.count === "number" && <span className="tabs__count num">{formatNumber(it.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Choix exclusif compact (ordre de tri, vue grille/liste). */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; title?: string }[];
  label: string;
}) {
  const id = useId();
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="radio"
            aria-checked={active}
            title={it.title}
            className={`segmented__item${active ? " is-active" : ""}`}
            onClick={() => onChange(it.value)}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="segmented__thumb"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="segmented__label">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={["input", props.className].filter(Boolean).join(" ")} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select">
      <select {...props}>{children}</select>
      <ChevronDown size={16} className="select__chev" aria-hidden />
    </span>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden>
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__text">
        <span>{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </span>
    </label>
  );
}

/** Pastille de filtre actif, retirable. */
export function Chip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <motion.span
      layout
      className="chip"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
    >
      <span className="chip__text">{children}</span>
      {onRemove && (
        <button className="chip__x" onClick={onRemove} aria-label={removeLabel}>
          <X size={13} />
        </button>
      )}
    </motion.span>
  );
}

/** Section repliable, hauteur animée. */
export function Disclosure({
  title,
  meta,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`disclosure${open ? " is-open" : ""}`}>
      <button className="disclosure__head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="disclosure__title">{title}</span>
        {meta && <span className="disclosure__meta">{meta}</span>}
        <ChevronDown size={18} className="disclosure__chev" aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            className="disclosure__body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="disclosure__inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Pagination : précédent, suivant, et la position dans la liste. */
export function Pager({
  offset,
  limit,
  total,
  onChange,
  capped,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
  capped?: boolean;
}) {
  const { t } = useTranslation();
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className="pager" aria-label={t("common.pagination")}>
      <button className="btn btn--secondary btn--md" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
        <ChevronLeft size={16} />
        <span>{t("common.previous")}</span>
      </button>
      <span className="pager__pos num">
        {t("common.pageOf", { page: formatNumber(page), pages: formatNumber(pages) + (capped ? "+" : "") })}
      </span>
      <button className="btn btn--secondary btn--md" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
        <span>{t("common.next")}</span>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
