import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Page, PageHead, Section } from "../components/page";
import { Cover } from "../components/ui/Media";
import { CountryTag } from "../components/ui/Badges";
import { Input, Segmented } from "../components/ui/Controls";
import { ErrorState, NotFound, Skeleton } from "../components/ui/States";
import { countries, country, countryPublications, type PublicationRow } from "../data/publications";
import { latestIssues } from "../data/issues";
import { topPeople } from "../data/people";
import { decodeSegment, inducksUrl, routes } from "../lib/routes";
import { formatDate, formatNumber, yearSpan } from "../lib/format";
import { countryName } from "../lib/inducks";
import { norm } from "../lib/text";
import { recordVisit } from "../lib/ui";
import { useEffect } from "react";

export function Countries() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const q = useQuery({ queryKey: ["countries"], queryFn: countries, staleTime: Infinity });
  const list = useMemo(() => {
    const nf = norm(filter);
    return (q.data ?? [])
      .map((c) => ({ ...c, label: countryName(c.code, c.name) }))
      .filter((c) => !nf || norm(c.label).includes(nf) || c.code === nf);
  }, [q.data, filter]);
  const max = Math.max(1, ...(q.data ?? []).map((c) => c.issues));

  return (
    <Page title={t("countries.title")}>
      <PageHead title={t("countries.title")} lead={t("countries.lead")}>
        <Input
          className="input--lg"
          placeholder={t("countries.filter")}
          aria-label={t("countries.filter")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </PageHead>
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {!q.data && !q.isError && <Skeleton w="100%" h={400} />}
      <ul className="country-list">
        {list.map((c) => (
          <li key={c.code}>
            <Link to={routes.country(c.code)}>
              <CountryTag code={c.code} decorative />
              <span className="country-list__name">{c.label}</span>
              <span className="country-list__bar" aria-hidden>
                <span style={{ width: `${Math.max(2, (100 * c.issues) / max)}%` }} />
              </span>
              <span className="country-list__n num">
                {t("counts.publications", { count: c.publications, n: formatNumber(c.publications) })}
              </span>
              <span className="country-list__n num muted">
                {t("counts.issues", { count: c.issues, n: formatNumber(c.issues) })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function PublicationTable({ list }: { list: PublicationRow[] }) {
  const { t } = useTranslation();
  return (
    <ul className="pub-table">
      {list.map((p) => (
        <li key={p.code}>
          <Link to={routes.publication(p.code)}>
            <span className="pub-table__cover">
              <Cover img={p.img} alt="" seed={p.code} />
            </span>
            <span className="pub-table__main">
              <strong>{p.title}</strong>
              <small className="code">{p.code}</small>
            </span>
            <span className="pub-table__years num">{yearSpan(p.first, p.last)}</span>
            <span className="pub-table__n num">{t("counts.issues", { count: p.issues, n: formatNumber(p.issues) })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Country() {
  const { t } = useTranslation();
  const code = decodeSegment(useParams().code ?? "");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"issues" | "title" | "recent">("issues");
  const info = useQuery({ queryKey: ["country", code], queryFn: () => country(code), staleTime: Infinity });
  const pubs = useQuery({ queryKey: ["country-pubs", code], queryFn: () => countryPublications(code), staleTime: Infinity });
  const latest = useQuery({ queryKey: ["latest", code, 12], queryFn: () => latestIssues(code, 12), staleTime: Infinity });
  const people = useQuery({ queryKey: ["top-people", code], queryFn: () => topPeople(code, 12), staleTime: Infinity });
  const name = countryName(code, info.data?.name);

  useEffect(() => {
    if (info.data) recordVisit({ kind: "country", code, label: name, href: routes.country(code) });
  }, [info.data, code, name]);

  const list = useMemo(() => {
    const nf = norm(filter);
    const arr = (pubs.data ?? []).filter((p) => !nf || norm(p.title).includes(nf) || norm(p.code).includes(nf));
    if (sort === "title") arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "recent") arr.sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
    else arr.sort((a, b) => b.issues - a.issues);
    return arr;
  }, [pubs.data, filter, sort]);

  if (info.data === null) return <Page title={code}><NotFound what={code} /></Page>;

  return (
    <Page title={name} wide>
      <PageHead
        title={name}
        crumbs={[{ label: t("nav.publications"), to: routes.countries() }, { label: name }]}
        lead={
          info.data
            ? t("country.lead", {
                pubs: formatNumber(info.data.publications),
                issues: formatNumber(info.data.issues),
                stories: formatNumber(info.data.stories),
              })
            : undefined
        }
        actions={
          <a className="btn btn--ghost btn--md" href={inducksUrl.country(code)} target="_blank" rel="noreferrer">
            <span>{t("common.onInducks")}</span>
            <ExternalLink size={15} />
          </a>
        }
      />

      {latest.data && latest.data.length > 0 && (
        <Section title={t("country.latest")}>
          <div className="issue-shelf">
            {latest.data.map((it) => (
              <Link key={it.issuecode} to={routes.issue(it.issuecode, it.publicationcode)} className="issue-tile">
                <Cover img={it.img} alt="" seed={it.issuecode} />
                <span className="issue-tile__title">
                  {it.publicationTitle} <span className="num">{it.number}</span>
                </span>
                <span className="issue-tile__date">{formatDate(it.date, "short")}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={t("country.publications", { count: pubs.data?.length ?? 0, n: formatNumber(pubs.data?.length ?? 0) })}
        aside={
          <div className="section__tools">
            <Input className="input--sm" placeholder={t("country.filter")} aria-label={t("country.filter")} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <Segmented
              label={t("search.sort")}
              value={sort}
              onChange={setSort}
              items={[
                { value: "issues", label: t("country.sortIssues") },
                { value: "recent", label: t("country.sortRecent") },
                { value: "title", label: t("country.sortTitle") },
              ]}
            />
          </div>
        }
      >
        {!pubs.data && <Skeleton w="100%" h={300} />}
        <PublicationTable list={list} />
      </Section>

      {people.data && people.data.length > 0 && (
        <Section title={t("country.creators", { country: name })} aside={<Link className="link" to={routes.creators() + `?nat=${code}`}>{t("common.seeAll")}</Link>}>
          <ul className="name-grid">
            {people.data.map((p) => (
              <li key={p.code}>
                <Link to={routes.creator(p.code)}>
                  <strong>{p.name}</strong>
                  <small className="num">{t("counts.stories", { count: p.stories, n: formatNumber(p.stories) })}</small>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
