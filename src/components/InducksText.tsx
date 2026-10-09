/**
 * Texte libre d'Inducks. Les commentaires portent des renvois sous forme de balises :
 *
 *   Remplace <publication fr/MPHS>Mickey Parade Géant Hors-Série</publication>
 *
 * Chaque renvoi devient un lien vers la fiche correspondante, sans HTML injecté.
 * Un commentaire fait de notes entre crochets (« [Main Italian publication.] [Testata
 * italiana principale.] ») est affiché une note par ligne, sans les crochets.
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

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"\]]+[^\s<>"\].,;:!?)]/gi;

/** Adresses web en clair (« www.wizardsofmickey.com ») rendues cliquables. */
function linkify(text: string, key: () => number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(<Fragment key={key()}>{text.slice(last, i)}</Fragment>);
    const href = m[0].startsWith("www.") ? `https://${m[0]}` : m[0];
    out.push(
      <a key={key()} className="link" href={href} target="_blank" rel="noreferrer nofollow">
        {m[0]}
      </a>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={key()}>{text.slice(last)}</Fragment>);
  return out;
}

export function InducksText({ text: raw, className }: { text: string | null | undefined; className?: string }) {
  if (!raw) return null;
  // Les sauts de ligne d'Inducks sont parfois écrits « <br> ».
  let text = raw
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
  const trimmed = text.trim();
  if (/^(?:\[[^[\]]*\][\s;]*)+$/.test(trimmed)) {
    text = trimmed.replace(/[\s;]+$/, "").slice(1, -1).replace(/\][\s;]*\[/g, "\n");
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = TAG.exec(text))) {
    if (m.index > last) parts.push(...linkify(text.slice(last, m.index), () => k++));
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
  if (last < text.length) parts.push(...linkify(text.slice(last), () => k++));
  return <p className={["prose", className].filter(Boolean).join(" ")}>{parts}</p>;
}
