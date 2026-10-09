import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { storyCards, type StoryCard } from "../data/stories";
import { routes } from "../lib/routes";
import { formatDate, formatNumber, year } from "../lib/format";
import { kindLabel } from "../lib/inducks";
import { Cover } from "./ui/Media";
import { Skeleton, ErrorState } from "./ui/States";
import { Code } from "./ui/Badges";

export function People({ list, max = 3 }: { list: { code: string; name: string }[]; max?: number }) {
  const shown = list.slice(0, max);
  return (
    <>
      {shown.map((p, i) => (
        <span key={p.code}>
          {i > 0 && ", "}
          <Link to={routes.creator(p.code)} className="person-link" onClick={(e) => e.stopPropagation()}>
            {p.name}
          </Link>
        </span>
      ))}
      {list.length > max && <span className="muted"> +{list.length - max}</span>}
    </>
  );
}

/** Une histoire dans une liste : vignette, titre, code, auteurs, date. */
export function StoryRow({ s, index = 0, owned }: { s: StoryCard; index?: number; owned?: boolean }) {
  const { t } = useTranslation();
  const sameTeam =
    s.writers.length > 0 &&
    s.writers.length === s.artists.length &&
    s.writers.every((w, i) => w.code === s.artists[i]?.code);
  return (
    <motion.li
      className="story-row"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index, 12) * 0.015 }}
    >
      <Link to={routes.story(s.storycode)} className="story-row__cover" tabIndex={-1} aria-hidden>
        <Cover img={s.img} alt="" seed={s.storycode} />
      </Link>
      <div className="story-row__body">
        <h3 className="story-row__title">
          <Link to={routes.story(s.storycode)}>{s.title || t("story.untitled")}</Link>
        </h3>
        {s.original && <p className="story-row__original">{s.original}</p>}
        <p className="story-row__meta">
          <Code>{s.storycode}</Code>
          {s.kind && s.kind !== "n" && <span className="story-row__kind">{kindLabel(s.kind)}</span>}
          {s.pages && <span>{t("story.pagesShort", { n: s.pages })}</span>}
          {s.heroName && <span>{s.heroName}</span>}
          {owned && <span className="owned-dot">{t("collection.owned")}</span>}
        </p>
        {(s.writers.length > 0 || s.artists.length > 0) && (
          <p className="story-row__credits">
            {sameTeam ? (
              <People list={s.writers} />
            ) : (
              <>
                {s.writers.length > 0 && (
                  <span>
                    <span className="muted">{t("roles.short.write")} </span>
                    <People list={s.writers} max={2} />
                  </span>
                )}
                {s.artists.length > 0 && (
                  <span>
                    <span className="muted">{t("roles.short.draw")} </span>
                    <People list={s.artists} max={2} />
                  </span>
                )}
              </>
            )}
          </p>
        )}
      </div>
      <div className="story-row__aside">
        <span className="story-row__date num" title={formatDate(s.date)}>
          {year(s.date) || "—"}
        </span>
        {s.pubs > 0 && (
          <span className="story-row__pubs num" title={t("story.publishedTimes", { count: s.pubs })}>
            {t("story.printings", { count: s.pubs, n: formatNumber(s.pubs) })}
          </span>
        )}
      </div>
    </motion.li>
  );
}

export function StoryRowSkeleton({ n = 6 }: { n?: number }) {
  return (
    <ul className="story-list" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <li className="story-row story-row--skeleton" key={i}>
          <div className="story-row__cover">
            <Skeleton h="100%" w="100%" r={3} />
          </div>
          <div className="story-row__body">
            <Skeleton w="55%" h={16} />
            <Skeleton w="35%" h={12} />
            <Skeleton w="45%" h={12} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Liste d'histoires à partir de leurs identifiants (les fiches sont chargées ici). */
export function StoryList({ sids, ownedSet, empty }: { sids: number[]; ownedSet?: Set<number>; empty?: React.ReactNode }) {
  const cards = useQuery({
    queryKey: ["cards", sids],
    queryFn: () => storyCards(sids),
    staleTime: Infinity,
    enabled: sids.length > 0,
  });
  if (!sids.length) return <>{empty ?? null}</>;
  if (cards.isError) return <ErrorState error={cards.error} retry={() => cards.refetch()} />;
  if (!cards.data) return <StoryRowSkeleton n={Math.min(sids.length, 8)} />;
  return (
    <ul className="story-list">
      {cards.data.map((s, i) => (
        <StoryRow key={s.sid} s={s} index={i} owned={ownedSet?.has(s.sid)} />
      ))}
    </ul>
  );
}

/** Variante en grille de vignettes (accueil, anniversaires). */
export function StoryShelf({ sids }: { sids: number[] }) {
  const { t } = useTranslation();
  const cards = useQuery({
    queryKey: ["cards", sids],
    queryFn: () => storyCards(sids),
    staleTime: Infinity,
    enabled: sids.length > 0,
  });
  if (!cards.data) {
    return (
      <div className="shelf">
        {Array.from({ length: Math.min(sids.length || 6, 8) }, (_, i) => (
          <div className="shelf__item" key={i}>
            <Skeleton h={180} w="100%" r={3} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="shelf">
      {cards.data.map((s) => (
        <Link key={s.sid} to={routes.story(s.storycode)} className="shelf__item">
          <Cover img={s.img} alt="" seed={s.storycode} />
          <span className="shelf__title">{s.title || t("story.untitled")}</span>
          <span className="shelf__sub">{s.writers.concat(s.artists).map((p) => p.name).filter((n, i, a) => a.indexOf(n) === i).slice(0, 2).join(", ")}</span>
        </Link>
      ))}
    </div>
  );
}
