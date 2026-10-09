import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Facts, Page, PageHead, Section } from "../components/page";
import { InducksText } from "../components/InducksText";
import { StoryList } from "../components/stories";
import { Cover } from "../components/ui/Media";
import { Disclosure, Input, Pager, Segmented } from "../components/ui/Controls";
import { ErrorState, NotFound, Skeleton } from "../components/ui/States";
import { seriesDetail, seriesList, seriesStories } from "../data/series";
import { publisherDetail } from "../data/publications";
import { decodeSegment, inducksUrl, routes } from "../lib/routes";
import { formatNumber, yearSpan } from "../lib/format";
import { countryName, languageName } from "../lib/inducks";
import { recordVisit } from "../lib/ui";
import { OnlyToggle } from "./Creators";
import { CountryTag } from "../components/ui/Badges";

export function SeriesList() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(h);
  }, [q]);
  const list = useQuery({
    queryKey: ["series", debounced, i18n.resolvedLanguage],
    queryFn: () => seriesList(debounced),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  return (
    <Page title={t("series.title")} wide>
      <PageHead title={t("series.title")} lead={t("series.lead")}>
        <Input className="input--lg" placeholder={t("series.search")} aria-label={t("series.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </PageHead>
      {list.isError && <ErrorState error={list.error} retry={() => list.refetch()} />}
      {!list.data && !list.isError && <Skeleton w="100%" h={400} />}
      <ul className="series-grid">
        {(list.data ?? []).map((s) => (
          <li key={s.code}>
            <Link to={routes.subseries(s.code)}>
              <Cover img={s.img} alt="" seed={s.code} />
              <span className="series-grid__text">
                <strong>{s.name}</strong>
                <small className="num">
                  {t("counts.stories", { count: s.stories, n: formatNumber(s.stories) })}
                  {yearSpan(s.first, s.last) && `, ${yearSpan(s.first, s.last)}`}
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

const PAGE = 30;

export function Series() {
  const { t, i18n } = useTranslation();
  const code = decodeSegment(useParams().code ?? "");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [only, setOnly] = useState<"stories" | "all">("stories");
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [order, code, only]);
  const q = useQuery({ queryKey: ["series-detail", code, i18n.resolvedLanguage], queryFn: () => seriesDetail(code), staleTime: Infinity });
  const page = useQuery({
    queryKey: ["series-stories", code, order, offset, only],
    queryFn: () => seriesStories(code, { order, offset, limit: PAGE, only }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  const s = q.data;
  useEffect(() => {
    if (s) recordVisit({ kind: "series", code: s.code, label: s.name, href: routes.subseries(s.code) });
  }, [s]);
  if (q.isError) return <Page><ErrorState error={q.error} retry={() => q.refetch()} /></Page>;
  if (q.data === null) return <Page title={code}><NotFound what={code} /></Page>;
  if (!s) return <Page><Skeleton w="40%" h={40} /><Skeleton w="100%" h={240} /></Page>;
  return (
    <Page title={s.name}>
      <PageHead
        crumbs={[{ label: t("nav.series"), to: routes.subseriesList() }, { label: s.name }]}
        title={s.name}
        actions={
          <a className="btn btn--ghost btn--md" href={inducksUrl.subseries(s.code)} target="_blank" rel="noreferrer">
            <span>{t("common.onInducks")}</span>
            <ExternalLink size={15} />
          </a>
        }
      />
      <Facts
        items={[
          [t("series.stories"), formatNumber(s.stories)],
          [t("series.years"), yearSpan(s.first, s.last)],
          [t("series.category"), s.category],
        ]}
      />
      {s.comment && <InducksText text={s.comment} className="detail__comment" />}
      {s.names.length > 1 && (
        <Disclosure title={t("series.names", { count: s.names.length })}>
          <dl className="lang-list lang-list--compact">
            {s.names.map((n) => (
              <div key={n.lang + n.name}>
                <dt>{n.name}</dt>
                <dd className="muted">{languageName(n.lang)}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      )}
      <Section
        id="stories"
        title={t("series.storiesTitle", { count: page.data?.total ?? 0, n: formatNumber(page.data?.total ?? 0) })}
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
        <div className={page.isPlaceholderData ? "is-stale" : undefined}>
          <StoryList sids={page.data?.sids ?? []} />
        </div>
        <Pager offset={offset} limit={PAGE} total={page.data?.total ?? 0} onChange={(o) => { setOffset(o); document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" }); }} />
      </Section>
    </Page>
  );
}

export function Publisher() {
  const { t } = useTranslation();
  const id = decodeSegment(useParams().id ?? "");
  const q = useQuery({ queryKey: ["publisher", id], queryFn: () => publisherDetail(id), staleTime: Infinity });
  const p = q.data;
  if (q.isError) return <Page><ErrorState error={q.error} retry={() => q.refetch()} /></Page>;
  if (q.data === null) return <Page title={id}><NotFound what={id} /></Page>;
  if (!p) return <Page><Skeleton w="40%" h={40} /><Skeleton w="100%" h={240} /></Page>;
  return (
    <Page title={p.name}>
      <PageHead
        crumbs={[{ label: t("nav.publications"), to: routes.countries() }, { label: p.name }]}
        title={p.name}
        lead={t("publisher.lead", { pubs: formatNumber(p.publications), issues: formatNumber(p.issues ?? 0) })}
        actions={
          <a className="btn btn--ghost btn--md" href={inducksUrl.publisher(p.id)} target="_blank" rel="noreferrer">
            <span>{t("common.onInducks")}</span>
            <ExternalLink size={15} />
          </a>
        }
      />
      <ul className="pub-table">
        {p.list.map((x) => (
          <li key={x.code}>
            <Link to={routes.publication(x.code)}>
              <span className="pub-table__cover">
                <Cover img={x.img} alt="" seed={x.code} />
              </span>
              <span className="pub-table__main">
                <strong>{x.title}</strong>
                <small>
                  <CountryTag code={x.countrycode} /> <span className="code">{x.code}</span>
                </small>
              </span>
              <span className="pub-table__years num" title={countryName(x.countrycode)}>
                {yearSpan(x.pubFirst, x.pubLast)}
              </span>
              <span className="pub-table__n num">{t("counts.issues", { count: x.pubIssues, n: formatNumber(x.pubIssues) })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
