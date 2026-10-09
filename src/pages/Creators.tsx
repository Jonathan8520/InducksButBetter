import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Facts, Page, PageHead, Section } from "../components/page";
import { YearChart } from "../components/YearChart";
import { InducksText } from "../components/InducksText";
import { StoryList } from "../components/stories";
import { Avatar, Cover } from "../components/ui/Media";
import { CountryTag } from "../components/ui/Badges";
import { Button } from "../components/ui/Button";
import { Input, Pager, Segmented, Select, Tabs } from "../components/ui/Controls";
import { ErrorState, NotFound, Skeleton, Spinner } from "../components/ui/States";
import { nationalities, personDetail, personIssues, personStories, topPeople } from "../data/people";
import { suggestPeople } from "../data/omni";
import { decodeSegment, inducksUrl, routes } from "../lib/routes";
import { formatDate, formatNumber, yearSpan } from "../lib/format";
import { countryName, roleLabel } from "../lib/inducks";
import { recordVisit } from "../lib/ui";

export function Creators() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const nat = params.get("nat") ?? "";
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(h);
  }, [q]);

  const nats = useQuery({ queryKey: ["nationalities"], queryFn: nationalities, staleTime: Infinity });
  const top = useInfiniteQuery({
    queryKey: ["people", nat],
    queryFn: ({ pageParam }) => topPeople(nat || undefined, 60, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 60 ? all.length * 60 : undefined),
    staleTime: Infinity,
  });
  const found = useQuery({
    queryKey: ["people-search", debounced],
    queryFn: () => suggestPeople(debounced),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  const list = debounced.length >= 2 ? (found.data ?? []) : (top.data?.pages.flat() ?? []);
  const natOptions = useMemo(
    () => (nats.data ?? []).map((n) => ({ ...n, label: countryName(n.code) })).sort((a, b) => a.label.localeCompare(b.label)),
    [nats.data],
  );

  return (
    <Page title={t("creators.title")}>
      <PageHead title={t("creators.title")} lead={t("creators.lead")}>
        <div className="toolbar">
          <Input className="input--lg" placeholder={t("creators.search")} aria-label={t("creators.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select
            aria-label={t("creators.nationality")}
            value={nat}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("nat", e.target.value);
              else next.delete("nat");
              setParams(next, { replace: true });
            }}
          >
            <option value="">{t("creators.allNationalities")}</option>
            {natOptions.map((n) => (
              <option key={n.code} value={n.code}>
                {n.label} ({formatNumber(n.n)})
              </option>
            ))}
          </Select>
        </div>
      </PageHead>
      {top.isError && <ErrorState error={top.error} retry={() => top.refetch()} />}
      {!top.data && !top.isError && <Skeleton w="100%" h={400} />}
      <ul className="people-list">
        {list.map((p, i) => (
          <li key={p.code}>
            <Link to={routes.creator(p.code)}>
              {!debounced && <span className="people-list__rank num">{i + 1}</span>}
              <Avatar name={p.name} code={p.code} size={40} />
              <span className="people-list__main">
                <strong>{p.name}</strong>
                <small>
                  {p.nationality && <CountryTag code={p.nationality} />}
                  {"last" in p && "first" in p && yearSpan(p.first, p.last) && (
                    <span className="num">{yearSpan(p.first, p.last)}</span>
                  )}
                </small>
              </span>
              <span className="people-list__n num">{t("counts.stories", { count: p.stories ?? 0, n: formatNumber(p.stories ?? 0) })}</span>
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

/** Histoires seulement, ou aussi couvertures, illustrations et articles. */
export function OnlyToggle({ value, onChange }: { value: "stories" | "all"; onChange: (v: "stories" | "all") => void }) {
  const { t } = useTranslation();
  return (
    <Segmented
      label={t("common.contentKind")}
      value={value}
      onChange={onChange}
      items={[
        { value: "stories", label: t("common.onlyStories") },
        { value: "all", label: t("common.everything") },
      ]}
    />
  );
}

/**
 * « Histoires seulement » est le réglage par défaut ; pour un dessinateur de couvertures
 * ou une série d'articles, il donnerait une liste vide. On bascule alors une fois sur « Tout ».
 */
export function useOnlyFallback(
  only: "stories" | "all",
  setOnly: (v: "stories" | "all") => void,
  total: number | undefined,
  key: string,
) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (only === "stories" && total === 0 && done.current !== key) {
      done.current = key;
      setOnly("all");
    }
  }, [only, total, key, setOnly]);
}

function CreatorStories({ code, total }: { code: string; total: number }) {
  const { t } = useTranslation();
  const [role, setRole] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [only, setOnly] = useState<"stories" | "all">("stories");
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [role, order, code, only]);
  const page = useQuery({
    queryKey: ["person-stories", code, role, order, offset, only],
    queryFn: () => personStories(code, { role, order, offset, limit: PAGE, only }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  useOnlyFallback(only, setOnly, role || page.isPlaceholderData ? undefined : page.data?.total, code);
  return (
    <Section
      id="stories"
      title={t("creator.stories", { count: page.data?.total ?? total, n: formatNumber(page.data?.total ?? total) })}
      aside={
        <div className="section__tools">
          <OnlyToggle value={only} onChange={setOnly} />
          <Select aria-label={t("search.role")} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t("creator.allRoles")}</option>
            <option value="write">{t("search.roleWrite")}</option>
            <option value="draw">{t("search.roleDraw")}</option>
            {["p", "w", "a", "i"].map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
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
  );
}

function CreatorIssues({ code, job, total }: { code: string; job: string; total: number }) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const q = useQuery({
    queryKey: ["person-issues", code, job, offset],
    queryFn: () => personIssues(code, job, offset, 48),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  return (
    <Section title={t(`creator.jobs.${job}`, { count: total, n: formatNumber(total) })}>
      <div className="issue-grid">
        {(q.data ?? []).map((it) => (
          <Link key={it.issuecode} to={routes.issue(it.issuecode, it.publicationcode)} className="issue-tile">
            <Cover img={it.img} alt="" seed={it.issuecode} />
            <span className="issue-tile__title">
              {it.publicationTitle} <span className="num">{it.number}</span>
            </span>
            <span className="issue-tile__date">{formatDate(it.date, "short")}</span>
          </Link>
        ))}
      </div>
      <Pager offset={offset} limit={48} total={total} onChange={setOffset} />
    </Section>
  );
}

export function Creator() {
  const { t } = useTranslation();
  const code = decodeSegment(useParams().code ?? "");
  const q = useQuery({ queryKey: ["person", code], queryFn: () => personDetail(code), staleTime: Infinity });
  const p = q.data;
  const [tab, setTab] = useState("stories");
  useEffect(() => setTab("stories"), [code]);

  useEffect(() => {
    if (p) recordVisit({ kind: "creator", code: p.code, label: p.name, href: routes.creator(p.code) });
  }, [p]);

  if (q.isError) return <Page><ErrorState error={q.error} retry={() => q.refetch()} /></Page>;
  if (q.data === null) return <Page title={code}><NotFound what={code} /></Page>;
  if (!p) return <Page><Skeleton w="40%" h={40} /><Skeleton w="100%" h={240} /></Page>;

  const maxRole = Math.max(1, ...p.roleCounts.map((r) => r.n));
  const tabs = [
    { value: "stories", label: t("creator.tabStories"), count: p.stories ?? 0 },
    ...p.jobs.map((j) => ({ value: `job-${j.job}`, label: t(`creator.jobTab.${j.job}`), count: j.n })),
  ];

  return (
    <Page title={p.name}>
      <PageHead
        crumbs={[{ label: t("nav.creators"), to: routes.creators() }, { label: p.name }]}
        title={
          <span className="person-title">
            <Avatar name={p.name} code={p.code} size={56} />
            <span>{p.name}</span>
          </span>
        }
        actions={
          <a className="btn btn--ghost btn--md" href={inducksUrl.creator(p.code)} target="_blank" rel="noreferrer">
            <span>{t("common.onInducks")}</span>
            <ExternalLink size={15} />
          </a>
        }
      />
      <div className="profile">
        <div className="profile__facts">
          <Facts
            items={[
              [t("creator.nationality"), p.nationality ? <Link className="link" to={routes.country(p.nationality)}>{countryName(p.nationality)}</Link> : ""],
              [t("creator.born"), [formatDate(p.born), p.bornplace].filter(Boolean).join(", ")],
              [t("creator.died"), [formatDate(p.died), p.diedplace].filter(Boolean).join(", ")],
              [t("creator.birthname"), p.birthname],
              [t("creator.aliases"), p.aliases.join(", ")],
              [t("creator.active"), yearSpan(p.first, p.last)],
              [t("creator.code"), <span className="code" key="c">{p.code}</span>],
            ]}
          />
          {p.comment && <InducksText text={p.comment} className="detail__comment" />}
          {p.links.length > 0 && (
            <ul className="link-list">
              {p.links.map((l) => (
                <li key={l.url}>
                  <a className="link" href={l.url} target="_blank" rel="noreferrer">
                    {l.site}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {p.roleCounts.length > 0 && (
          <div className="profile__roles">
            <h2>{t("creator.work")}</h2>
            <ul className="bars">
              {p.roleCounts.map((r) => (
                <li key={r.role}>
                  <span className="bars__label">{roleLabel(r.role)}</span>
                  <span className="bars__track">
                    <span style={{ width: `${(100 * r.n) / maxRole}%` }} />
                  </span>
                  <span className="bars__n num">{formatNumber(r.n)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <YearChart
        years={p.years}
        label={t("chart.title")}
        hrefFor={(y) => routes.search({ by: p.code, from: String(y), to: String(y), sort: "date_asc" })}
      />

      {(p.topCharacters.length > 0 || p.collaborators.length > 0) && (
        <div className="two-col">
          {p.topCharacters.length > 0 && (
            <Section title={t("creator.topCharacters")}>
              <ol className="rank-list">
                {p.topCharacters.map((c) => (
                  <li key={c.code}>
                    <Link className="link" to={routes.character(c.code)}>
                      {c.name}
                    </Link>
                    <span className="num muted">{formatNumber(c.total)}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {p.collaborators.length > 0 && (
            <Section title={t("creator.collaborators")}>
              <ol className="rank-list">
                {p.collaborators.map((c) => (
                  <li key={c.code}>
                    <Link className="link" to={routes.creator(c.code)}>
                      {c.name}
                    </Link>
                    <span className="num muted">{formatNumber(c.total)}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      )}

      {tabs.length > 1 && <Tabs label={t("creator.tabs")} value={tab} onChange={setTab} items={tabs} />}
      {tab === "stories" ? (
        <CreatorStories code={p.code} total={p.stories ?? 0} />
      ) : (
        <CreatorIssues code={p.code} job={tab.slice(4)} total={p.jobs.find((j) => `job-${j.job}` === tab)?.n ?? 0} />
      )}
    </Page>
  );
}
