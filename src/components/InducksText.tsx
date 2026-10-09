/**
 * Texte libre d'Inducks. Les commentaires portent des renvois sous forme de balises :
 *
 *   Remplace <publication fr/MPHS>Mickey Parade Géant Hors-Série</publication>
 *
 * Chaque renvoi devient un lien vers la fiche correspondante, sans HTML injecté.
 * Les crochets « [texte] » des commentaires d'Inducks sont conservés tels quels.
 */
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { routes } from "../lib/routes";

const TAG = /<(creator|studio|hero|universe|publication|issue|story)\s+([^>]*)>([^<]*)<\/\1>/g;

/** Liens HTML d'Inducks (« <a href='publication.php?c=it/TG'>…</a> ») ramenés aux balises maison. */
const PHP_LINK = /<a\s+href=['"](?:https?:\/\/(?:www\.)?inducks\.org\/)?(story|issue|publication|creator|character|universe)\.php\?c=([^'"&]+)[^'"]*['"][^>]*>([^<]*)<\/a>/gi;
const PHP_ENTITY: Record<string, string> = {
  story: "story",
  issue: "issue",
  publication: "publication",
  creator: "creator",
  character: "hero",
  universe: "universe",
};

function hrefFor(entity: string, code: string): string | null {
  switch (entity) {
    case "creator":
      return routes.creator(code);
    case "hero":
      return routes.character(code);
    case "universe":
      return routes.universe(code);
    case "publication":
      return routes.publication(code);
    case "issue":
      return routes.issue(code);
    case "story":
      return routes.story(code);
    default:
      return null;
  }
}

export function InducksText({ text: raw, className }: { text: string | null | undefined; className?: string }) {
  if (!raw) return null;
  // Les sauts de ligne d'Inducks sont parfois écrits « <br> ».
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(PHP_LINK, (_m, page: string, code: string, label: string) => {
      const entity = PHP_ENTITY[page.toLowerCase()];
      let c = code;
      try {
        c = decodeURIComponent(code.replace(/\+/g, " "));
      } catch {
        /* code laissé tel quel */
      }
      return `<${entity} ${c}>${label}</${entity}>`;
    })
    // Toute autre balise HTML résiduelle est retirée, son texte conservé.
    .replace(/<(?!\/?(?:creator|studio|hero|universe|publication|issue|story)\b)[^>]+>/gi, "");
  const parts: React.ReactNode[] = [];
  let last = 0;
  TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = TAG.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    const href = hrefFor(m[1], m[2].trim());
    const label = m[3].trim() || m[2].trim();
    parts.push(
      href ? (
        <Link key={k++} to={href} className="link">
          {label}
        </Link>
      ) : (
        <Fragment key={k++}>{label}</Fragment>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return <p className={["prose", className].filter(Boolean).join(" ")}>{parts}</p>;
}
