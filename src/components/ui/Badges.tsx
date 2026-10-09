import { Link } from "react-router-dom";
import { countryName, kindLabel } from "../../lib/inducks";
import { routes } from "../../lib/routes";

/** Code Inducks : les espaces de remplissage sont significatifs, on les garde. */
export function Code({ children, className }: { children: string; className?: string }) {
  return <span className={["code", className].filter(Boolean).join(" ")}>{children}</span>;
}

export function KindTag({ kind }: { kind: string | null | undefined }) {
  if (!kind) return null;
  return <span className={`kind kind--${kind === "n" ? "story" : "other"}`}>{kindLabel(kind)}</span>;
}

/** Pays : un code court et lisible, le nom complet au survol et pour les lecteurs d'écran. */
export function CountryTag({
  code,
  link = false,
  name,
  decorative = false,
}: {
  code: string;
  link?: boolean;
  name?: string | null;
  /** Le nom du pays est déjà écrit à côté : l'étiquette n'est pas lue une seconde fois. */
  decorative?: boolean;
}) {
  const label = countryName(code, name);
  if (decorative) {
    return (
      <span className="country-tag" aria-hidden>
        {code.toUpperCase()}
      </span>
    );
  }
  const content = (
    <>
      <span aria-hidden>{code.toUpperCase()}</span>
      <span className="sr-only">{label}</span>
    </>
  );
  if (link) {
    return (
      <Link to={routes.country(code)} className="country-tag" title={label}>
        {content}
      </Link>
    );
  }
  return (
    <span className="country-tag" title={label}>
      {content}
    </span>
  );
}
