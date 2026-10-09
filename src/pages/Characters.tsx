import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Search } from "lucide-react";
import { Facts, Page, PageHead, Section } from "../components/page";
import { InducksText } from "../components/InducksText";
import { StoryList } from "../components/stories";
import { Avatar } from "../components/ui/Media";
import { Button, ButtonLink } from "../components/ui/Button";
import { Disclosure, Input, Pager, Segmented } from "../components/ui/Controls";
import { ErrorState, NotFound, Skeleton, Spinner } from "../components/ui/States";
import { characterDetail, characterStories, topCharacters, universeDetail, universes } from "../data/characters";
import { suggestCharacters } from "../data/omni";
import { storyCards } from "../data/stories";
import { decodeSegment, inducksUrl, routes } from "../lib/routes";
import { formatDate, formatNumber, yearSpan } from "../lib/format";
import { languageName } from "../lib/inducks";
import { norm } from "../lib/text";
import { recordVisit } from "../lib/ui";
import { OnlyToggle } from "./Creators";

export function Characters() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(h);
  }, [q]);
  const top = useInfiniteQuery({
    queryKey: ["characters"],
    queryFn: ({ pageParam }) => topCharacters(60, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 60 ? all.length * 60 : undefined),
    staleTime: Infinity,
  });
  const found = useQuery({
    queryKey: ["char-search", debounced],
    queryFn: () => suggestCharacters(debounced),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  const list = debounced.length >= 2 ? (found.data ?? []) : (top.data?.pages.flat() ?? []);
  return (
    <Page title={t("characters.title")}>
      <PageHead
        title={t("characters.title")}
        lead={t("characters.lead")}
        actions={<ButtonLink to={routes.universes()}>{t("nav.universes")}</ButtonLink>}
      >
        <Input className="input--lg" placeholder={t("characters.search")} aria-label={t("characters.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </PageHead>
      {!top.data && !top.isError && <Skeleton w="100%" h={400} />}
      <ul className="people-list">
        {list.map((c, i) => (
          <li key={c.code}>
            <Link to={routes.character(c.code)}>
              {!debounced && <span className="people-list__rank num">{i + 1}</span>}
              <Avatar name={c.name} code={c.code} size={40} />
              <span className="people-list__main">
                <strong>{c.name}</strong>
                <small className="code">{c.code}</small>
              </span>
              <span className="people-list__n num">{t("counts.stories", { count: c.stories ?? 0, n: formatNumber(c.stories ?? 0) })}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!debounced && top.hasNextPage && (
        <div className="load-more">
          <Button onClick={() => top.fetchNextPage()} disabled={top.isFetchingNextPage}>
            {top.isFetchingNextPage ? <Spinner size={14} /> : t("common.loadMore")}
          </Button>
        </div>
      )}
    </Page>
  );
}

const PAGE = 30;

export function Character() {
  const { t, i18n } = useTranslation();
  const code = decodeSegment(useParams().code ?? "");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [only, setOnly] = useState<"stories" | "all">("stories");
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [order, code, only]);
  const q = useQuery({ queryKey: ["character", code, i18n.resolvedLanguage], queryFn: () => characterDetail(code), staleTime: Infinity });
  const page = useQuery({
    queryKey: ["char-stories", code, order, offset, only],
    queryFn: () => characterStories(code, { order, offset, limit: PAGE, only }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  const first = useQuery({
    queryKey: ["cards", [q.data?.first_sid]],
    queryFn: () => storyCards([q.data!.first_sid!]),
    enabled: !!q.data?.first_sid,
    staleTime: Infinity,
  });
  const c = q.data;

  useEffect(() => {
    if (c) recordVisit({ kind: "character", code: c.code, label: c.localName, href: routes.character(c.code) });
  }, [c]);

  const names = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const n of c?.names ?? []) {
      const arr = by.get(n.name) ?? [];
      arr.push(n.lang);
      by.set(n.name, arr);
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [c]);

  if (q.isError) return <Page><ErrorState error={q.error} retry={() => q.refetch()} /></Page>;
  if (q.data === null) return <Page title={code}><NotFound what={code} /></Page>;
  if (!c) return <Page><Skeleton w="40%" h={40} /><Skeleton w="100%" h={240} /></Page>;
  const firstStory = first.data?.[0];

  return (
    <Page title={c.localName}>
      <PageHead
        crumbs={[{ label: t("nav.characters"), to: routes.characters() }, { label: c.localName }]}
        title={
          <span className="person-title">
            <Avatar name={c.localName} code={c.code} size={56} />
            <span>{c.localName}</span>
          </span>
        }
        lead={c.localName !== c.name ? c.name : undefined}
        actions={
          <>
            <ButtonLink to={routes.search({ char: c.code })} icon={<Search size={15} />}>
              {t("character.searchWith")}
            </ButtonLink>
            <a className="btn btn--ghost btn--md" href={inducksUrl.character(c.code)} target="_blank" rel="noreferrer">
              <span>{t("common.onInducks")}</span>
              <ExternalLink size={15} />
            </a>
          </>
        }
      />
      <div className="profile">
        <div className="profile__facts">
          <Facts
            items={[
              [t("character.stories"), formatNumber(c.stories ?? 0)],
              [t("character.years"), yearSpan(c.first, c.last)],
              [
                t("character.firstAppearance"),
                firstStory ? (
                  <Link className="link" to={routes.story(firstStory.storycode)}>
                    {firstStory.title} ({formatDate(firstStory.date)})
                  </Link>
                ) : (
                  formatDate(c.first)
                ),
              ],
              [
                t("character.universes"),
                c.universes.length ? (
                  <span className="inline-list">
                    {c.universes.map((u) => (
                      <Link key={u.code} className="link" to={routes.universe(u.code)}>
                        {u.name}
                      </Link>
                    ))}
                  </span>
                ) : (
                  ""
                ),
              ],
              [t("character.aliases"), c.aliases.join(", ")],
              [t("creator.code"), <span className="code" key="c">{c.code}</span>],
            ]}
          />
          {c.comment && <InducksText text={c.comment} className="detail__comment" />}
          {names.length > 1 && (
            <Disclosure title={t("character.names", { count: names.length })}>
              <dl className="lang-list lang-list--compact">
                {names.map(([name, langs]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd className="muted">{langs.map((l) => languageName(l)).join(", ")}</dd>
                  </div>
                ))}
              </dl>
            </Disclosure>
          )}
        </div>
        <div className="profile__side">
          {c.creators.length > 0 && (
            <>
              <h2>{t("character.topCreators")}</h2>
              <ol className="rank-list">
                {c.creators.slice(0, 8).map((p) => (
                  <li key={p.code}>
                    <Link className="link" to={routes.creator(p.code)}>
                      {p.name}
                    </Link>
                    <span className="num muted">{formatNumber(p.total)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {c.coCharacters.length > 0 && (
            <>
              <h2>{t("character.coCharacters")}</h2>
              <ol className="rank-list">
                {c.coCharacters.slice(0, 8).map((p) => (
                  <li key={p.code}>
                    <Link className="link" to={routes.character(p.code)}>
                      {p.name}
                    </Link>
                    <span className="num muted">{formatNumber(p.total)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>

      <Section
        id="stories"
        title={t("character.storiesTitle", { count: page.data?.total ?? 0, n: formatNumber(page.data?.total ?? 0) })}
        aside={
          <div className="section__tools">
            <OnlyToggle value={only} onChange={setOnly} />
            <Segmented
              label={t("search.sort")}
              value={order}
              onChange={setOrder}
              items={[
                { value: "asc", label: t("common.oldest") },
                { value: "desc", label: t("common.newest") },
              ]}
            />
          </div>
        }
      >
        {page.isError && <ErrorState error={page.error} retry={() => page.refetch()} />}
        <div className={page.isPlaceholderData ? "is-stale" : undefined}>
          <StoryList sids={page.data?.sids ?? []} />
        </div>
        <Pager offset={offset} limit={PAGE} total={page.data?.total ?? 0} onChange={(o) => { setOffset(o); document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" }); }} />
      </Section>
    </Page>
  );
}

export function Universes() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const q = useQuery({ queryKey: ["universes"], queryFn: universes, staleTime: Infinity });
  const list = (q.data ?? []).filter((u) => !filter || norm(u.name + " " + u.code).includes(norm(filter)));
  return (
    <Page title={t("universes.title")}>
      <PageHead title={t("universes.title")} lead={t("universes.lead")}>
        <Input className="input--lg" placeholder={t("universes.filter")} aria-label={t("universes.filter")} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </PageHead>
      {!q.data && !q.isError && <Skeleton w="100%" h={300} />}
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      <ul className="name-grid name-grid--wide">
        {list.map((u) => (
          <li key={u.code}>
            <Link to={routes.universe(u.code)}>
              <strong>{u.name}</strong>
              <small className="num">{t("counts.characters", { count: u.characters, n: formatNumber(u.characters) })}</small>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function Universe() {
  const { t } = useTranslation();
  const code = decodeSegment(useParams().code ?? "");
  const q = useQuery({ queryKey: ["universe", code], queryFn: () => universeDetail(code), staleTime: Infinity });
  const u = q.data;
  useEffect(() => {
    if (u) recordVisit({ kind: "universe", code: u.code, label: u.name, href: routes.universe(u.code) });
  }, [u]);
  if (q.isError) return <Page><ErrorState error={q.error} retry={() => q.refetch()} /></Page>;
  if (q.data === null) return <Page title={code}><NotFound what={code} /></Page>;
  if (!u) return <Page><Skeleton w="40%" h={40} /><Skeleton w="100%" h={240} /></Page>;
  return (
    <Page title={u.name}>
      <PageHead
        crumbs={[{ label: t("nav.universes"), to: routes.universes() }, { label: u.name }]}
        title={u.name}
        lead={t("counts.characters", { count: u.characters, n: formatNumber(u.characters) })}
        actions={
          <a className="btn btn--ghost btn--md" href={inducksUrl.universe(u.code)} target="_blank" rel="noreferrer">
            <span>{t("common.onInducks")}</span>
            <ExternalLink size={15} />
          </a>
        }
      />
      {u.comment && <InducksText text={u.comment} className="detail__comment" />}
      <Section title={t("universe.members")}>
        <ul className="people-list">
          {u.members.map((m) => (
            <li key={m.code}>
              <Link to={routes.character(m.code)}>
                <Avatar name={m.name} code={m.code} size={36} />
                <span className="people-list__main">
                  <strong>{m.name}</strong>
                  <small className="code">{m.code}</small>
                </span>
                <span className="people-list__n num">{t("counts.stories", { count: m.stories, n: formatNumber(m.stories) })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
