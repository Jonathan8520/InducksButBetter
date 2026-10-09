import { useEffect, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Enveloppe de page : titre du document et apparition discrète au changement de route. */
export function Page({ title, children, wide }: { title?: string; children: ReactNode; wide?: boolean }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    document.title = title ? `${title} | InducksButBetter` : "InducksButBetter";
  }, [title]);
  return (
    <motion.div
      className={`page${wide ? " page--wide" : ""}`}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export interface Crumb {
  label: ReactNode;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { t } = useTranslation();
  return (
    <nav className="crumbs" aria-label={t("common.breadcrumbs")}>
      <ol>
        {items.map((c, i) => (
          <li key={i}>
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            {i < items.length - 1 && <ChevronRight size={14} aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHead({
  title,
  lead,
  crumbs,
  actions,
  children,
}: {
  title: ReactNode;
  lead?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="page-head__row">
        <h1>{title}</h1>
        {actions && <div className="page-head__actions">{actions}</div>}
      </div>
      {lead && <p className="page-head__lead">{lead}</p>}
      {children}
    </header>
  );
}

export function Section({
  title,
  aside,
  children,
  id,
  className,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section className={["section", className].filter(Boolean).join(" ")} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      {(title || aside) && (
        <div className="section__head">
          {title && <h2 id={id ? `${id}-title` : undefined}>{title}</h2>}
          {aside && <div className="section__aside">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Liste de faits « libellé : valeur », valeurs vides omises. */
export function Facts({ items }: { items: [ReactNode, ReactNode][] }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  if (!shown.length) return null;
  return (
    <dl className="facts">
      {shown.map(([k, v], i) => (
        <div className="facts__row" key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExternalLinkBtn({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="btn btn--ghost btn--sm" href={href} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <ExternalLink size={14} />
    </a>
  );
}
