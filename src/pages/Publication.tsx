import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardList, ExternalLink, Grid3x3, List } from "lucide-react";
import { Breadcrumbs, Facts, Page, Section } from "../components/page";
import { InducksText } from "../components/InducksText";
import { Cover } from "../components/ui/Media";
import { Code, CountryTag } from "../components/ui/Badges";
import { Input, Segmented } from "../components/ui/Controls";
import { Button } from "../components/ui/Button";
import { ErrorState, NotFound, Skeleton } from "../components/ui/States";
import { publicationDetail, publicationIssues } from "../data/publications";
import type { IssueTile } from "../data/issues";
import { decodeSegment, inducksUrl, routes } from "../lib/routes";
import { formatDate, formatNumber, year, yearSpan } from "../lib/format";
import { countryName, languageName } from "../lib/inducks";
import { collection, compactNumbers } from "../lib/collection";
import { recordVisit, ui } from "../lib/ui";

function groupByYear(list: IssueTile[]) {
  const map = new Map<string, IssueTile[]>();
  for (const it of list) {
    const y = year(it.date) || "?";
    const arr = map.get(y) ?? [];
    arr.push(it);
    map.set(y, arr);
  }
  // Les numéros sans date connue ferment la liste au lieu de l'ouvrir.
  const key = (y: string) => (y === "?" ? "9999" : y);
  return [...map.entries()].sort((a, b) => (key(a[0]) < key(b[0]) ? -1 : key(a[0]) > key(b[0]) ? 1 : 0));
}

export default function Publication() {
  const { t } = useTranslation();
  const params = useParams();
  const code = `${decodeSegment(params.country ?? "")}/${decodeSegment(params.pub ?? "")}`;
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("");
  const [show, setShow] = useState<"all" | "owned" | "missing">("all");
  const owned = collection.use((c) => c.issues);
  const ownedSet = useMemo(() => new Set(owned), [owned]);

  const pub = useQuery({ queryKey: ["publication", code], queryFn: () => publicationDetail(code), staleTime: Infinity });
  const issues = useQuery({ queryKey: ["pub-issues", code], queryFn: () => publicationIssues(code), staleTime: Infinity });
  const p = pub.data;

  useEffect(() => {
    if (p) recordVisit({ kind: "publication", code: p.code, label: p.title, sub: p.code, href: routes.publication(p.code) });
  }, [p]);

  const filtered = useMemo(() => {
    let list = issues.data ?? [];
    if (show !== "all") list = list.filter((i) => ownedSet.has(i.issuecode) === (show === "owned"));
    const f = filter.trim().toLowerCase();
    if (!f) return list;
    return list.filter((i) => i.number.toLowerCase().includes(f) || (i.title ?? "").toLowerCase().includes(f) || (i.date ?? "").startsWith(f));
  }, [issues.data, filter, show, ownedSet]);
  const groups = useMemo(() => groupByYear(filtered), [filtered]);
  const ownedCount = useMemo(() => (issues.data ?? []).filter((i) => ownedSet.has(i.issuecode)).length, [issues.data, ownedSet]);

  if (pub.isError) return <Page><ErrorState error={pub.error} retry={() => pub.refetch()} /></Page>;
  if (pub.data === null) return <Page title={code}><NotFound what={code} /></Page>;
  if (!p) return <Page><Skeleton w="50%" h={40} /><Skeleton w="100%" h={300} /></Page>;

  return (
    <Page title={p.title} wide>
      <Breadcrumbs
        items={[
          { label: t("nav.publications"), to: routes.countries() },
          { label: countryName(p.countrycode), to: routes.country(p.countrycode) },
          { label: p.title },
        ]}
      />
      <header className="pub-head">
        <div className="pub-head__cover">
          <Cover img={p.img} alt="" quality="medium" seed={p.code} eager />
        </div>
        <div className="pub-head__text">
          <div className="detail__eyebrow">
            <CountryTag code={p.countrycode} link />
            <Code>{p.code}</Code>
          </div>
          <h1>{p.title}</h1>
          {p.names.length > 0 && <p className="detail__subtitle">{p.names.join(", ")}</p>}
          <Facts
            items={[
              [t("publication.years"), yearSpan(p.first, p.last)],
              [t("publication.issues"), formatNumber(p.issues)],
              [t("publication.language"), languageName(p.lang)],
              [t("publication.size"), p.size],
              [
                t("publication.publishers"),
                p.publishers.length ? (
                  <span className="inline-list">
                    {p.publishers.map((x) => (
                      <Link key={x.id} className="link" to={routes.publisher(x.id)} title={yearSpan(x.first, x.last)}>
                        {x.name}
                      </Link>
                    ))}
                  </span>
                ) : (
                  ""
                ),
              ],
              [t("publication.owned"), ownedCount ? t("publication.ownedN", { n: formatNumber(ownedCount), total: formatNumber(p.issues) }) : ""],
            ]}
          />
          {p.comment && <InducksText text={p.comment} className="detail__comment" />}
          <div className="detail__actions">
            {ownedCount > 0 && ownedCount < (issues.data?.length ?? 0) && (
              <Button
                icon={<ClipboardList size={16} />}
                onClick={async () => {
                  const missing = (issues.data ?? [])
                    .filter((i) => !ownedSet.has(i.issuecode))
                    .map((i) => i.number)
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                  const text = `${p.title} : ${compactNumbers(missing)}`;
                  try {
                    await navigator.clipboard.writeText(text);
                    ui.toast(t("publication.wantCopied", { count: missing.length, n: formatNumber(missing.length) }), "ok");
                  } catch {
                    ui.toast(text);
                  }
                }}
              >
                {t("publication.copyMissing")}
              </Button>
            )}
            <a className="btn btn--ghost btn--md" href={inducksUrl.publication(p.code)} target="_blank" rel="noreferrer">
              <span>{t("common.onInducks")}</span>
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </header>

      <Section
        title={t("publication.allIssues", { count: p.issues, n: formatNumber(p.issues) })}
        aside={
          <div className="section__tools">
            <Input
              placeholder={t("publication.filter")}
              aria-label={t("publication.filter")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input--sm"
            />
            {ownedCount > 0 && (
              <Segmented
                label={t("publication.show")}
                value={show}
                onChange={setShow}
                items={[
                  { value: "all", label: t("publication.showAll") },
                  { value: "owned", label: t("publication.showOwned") },
                  { value: "missing", label: t("publication.showMissing") },
                ]}
              />
            )}
            <Segmented
              label={t("common.view")}
              value={view}
              onChange={setView}
              items={[
                { value: "grid", label: <Grid3x3 size={16} />, title: t("common.grid") },
                { value: "list", label: <List size={16} />, title: t("common.list") },
              ]}
            />
          </div>
        }
      >
        {issues.isError && <ErrorState error={issues.error} retry={() => issues.refetch()} />}
        {!issues.data && !issues.isError && <Skeleton w="100%" h={260} />}
        {issues.data && groups.length > 8 && (
          <nav className="year-jump" aria-label={t("publication.jump")}>
            {groups.map(([y]) => (
              <a key={y} href={`#y-${y}`}>
                {y}
              </a>
            ))}
          </nav>
        )}
        {groups.map(([y, list]) => (
          <div key={y} id={`y-${y}`} className="year-group">
            <h3 className="year-group__title num">
              {y} <span className="muted">{formatNumber(list.length)}</span>
            </h3>
            {view === "grid" ? (
              <div className="issue-grid">
                {list.map((it) => (
                  <Link key={it.issuecode} to={routes.issue(it.issuecode, it.publicationcode)} className={`issue-tile${ownedSet.has(it.issuecode) ? " is-owned" : ""}`}>
                    <Cover img={it.img} alt="" seed={it.issuecode} />
                    <span className="issue-tile__title num">{it.number}</span>
                    {it.title && <span className="issue-tile__sub">{it.title}</span>}
                    <span className="issue-tile__date">{formatDate(it.date, "short")}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <ul className="issue-lines">
                {list.map((it) => (
                  <li key={it.issuecode} className={ownedSet.has(it.issuecode) ? "is-owned" : undefined}>
                    <Link to={routes.issue(it.issuecode, it.publicationcode)}>
                      <span className="num issue-lines__n">{it.number}</span>
                      <span className="issue-lines__title">{it.title ?? ""}</span>
                      <span className="issue-lines__date num">{formatDate(it.date, "short")}</span>
                      <span className="issue-lines__count num muted">{it.stories ? t("counts.storiesShort", { n: it.stories }) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>
    </Page>
  );
}
