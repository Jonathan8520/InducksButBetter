import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookMarked, Copy, ExternalLink, Maximize2 } from "lucide-react";
import { Facts, Page, Section } from "../components/page";
import { Breadcrumbs } from "../components/page";
import { InducksText } from "../components/InducksText";
import { Cover, Avatar } from "../components/ui/Media";
import { Code, CountryTag, KindTag } from "../components/ui/Badges";
import { IconButton } from "../components/ui/Button";
import { Disclosure, Segmented } from "../components/ui/Controls";
import { Dialog } from "../components/ui/Overlay";
import { ErrorState, NotFound, Skeleton } from "../components/ui/States";
import { storyDetail, storyPublications, type Publication } from "../data/stories";
import { decodeSegment, inducksUrl, routes } from "../lib/routes";
import { formatDate, formatNumber } from "../lib/format";
import { countryName, fullUrl, kindLabel, languageName, rolesLabel } from "../lib/inducks";
import { ownsIssue } from "../lib/collection";
import { recordVisit, ui } from "../lib/ui";

function StorySkeleton() {
  return (
    <div className="detail">
      <div className="detail__media">
        <Skeleton w="100%" h={380} r={3} />
      </div>
      <div className="detail__main">
        <Skeleton w={120} h={14} />
        <Skeleton w="70%" h={36} />
        <Skeleton w="40%" h={16} />
        <Skeleton w="100%" h={120} />
      </div>
    </div>
  );
}

function Publications({ sid, total }: { sid: number; total: number }) {
  const { t } = useTranslation();
  const [view, setView] = useState<"country" | "date">("country");
  const pubs = useQuery({ queryKey: ["story-pubs", sid], queryFn: () => storyPublications(sid), staleTime: Infinity });
  const groups = useMemo(() => {
    const list = pubs.data ?? [];
    const by = new Map<string, Publication[]>();
    for (const p of list) {
      const arr = by.get(p.countrycode) ?? [];
      arr.push(p);
      by.set(p.countrycode, arr);
    }
    for (const arr of by.values()) arr.sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [pubs.data]);
  const chrono = useMemo(
    () => [...(pubs.data ?? [])].sort((a, b) => (a.date || "9").localeCompare(b.date || "9")),
    [pubs.data],
  );

  if (!total) return null;
  const Row = ({ p }: { p: Publication }) => (
    <li className="pub-row">
      <span className="pub-row__date num">{formatDate(p.date, "short") || "—"}</span>
      <span className="pub-row__main">
        <Link to={routes.issue(p.issuecode, p.publicationcode)} className="pub-row__issue">
          {p.publicationTitle} <span className="num">{p.issuecode.slice(p.publicationcode.length).trim()}</span>
        </Link>
        {p.title && <span className="pub-row__title">{p.title}</span>}
      </span>
      <span className="pub-row__side">
        {p.part && <span className="muted">{t("story.part", { n: p.part })}</span>}
        {ownsIssue(p.issuecode) && <span className="owned-dot">{t("collection.owned")}</span>}
      </span>
    </li>
  );

  return (
    <Section
      id="publications"
      title={t("story.publications", { count: total, n: formatNumber(total) })}
      aside={
        <Segmented
          label={t("story.groupBy")}
          value={view}
          onChange={setView}
          items={[
            { value: "country", label: t("story.byCountry") },
            { value: "date", label: t("story.byDate") },
          ]}
        />
      }
    >
      {pubs.isError && <ErrorState error={pubs.error} retry={() => pubs.refetch()} />}
      {!pubs.data && !pubs.isError && <Skeleton w="100%" h={160} />}
      {pubs.data && view === "country" && (
        <div className="pub-groups">
          {groups.map(([cc, list], i) => (
            <Disclosure
              key={cc}
              defaultOpen={i < 2 || groups.length <= 3}
              title={
                <>
                  <CountryTag code={cc} />
                  <span>{countryName(cc)}</span>
                </>
              }
              meta={
                <span className="num">
                  {formatNumber(list.length)}
                  {list[0]?.date ? `, ${t("story.since", { year: list[0].date.slice(0, 4) })}` : ""}
                </span>
              }
            >
              <ul className="pub-list">
                {list.map((p) => (
                  <Row key={p.issuecode + p.pos} p={p} />
                ))}
              </ul>
            </Disclosure>
          ))}
        </div>
      )}
      {pubs.data && view === "date" && (
        <ul className="pub-list pub-list--flat">
          {chrono.map((p) => (
            <li key={p.issuecode + p.pos} className="pub-row">
              <span className="pub-row__date num">{formatDate(p.date, "short") || "—"}</span>
              <span className="pub-row__main">
                <span className="pub-row__issue-line">
                  <CountryTag code={p.countrycode} />
                  <Link to={routes.issue(p.issuecode, p.publicationcode)} className="pub-row__issue">
                    {p.publicationTitle} <span className="num">{p.issuecode.slice(p.publicationcode.length).trim()}</span>
                  </Link>
                </span>
                {p.title && <span className="pub-row__title">{p.title}</span>}
              </span>
              <span className="pub-row__side">
                {ownsIssue(p.issuecode) && <span className="owned-dot">{t("collection.owned")}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function Story() {
  const { t, i18n } = useTranslation();
  const code = decodeSegment(useParams().code ?? "");
  const [zoom, setZoom] = useState(false);
  const q = useQuery({ queryKey: ["story", code, i18n.resolvedLanguage], queryFn: () => storyDetail(code), staleTime: Infinity });
  const s = q.data;

  useEffect(() => {
    if (s) recordVisit({ kind: "story", code: s.storycode, label: s.title || s.storycode, sub: s.storycode, href: routes.story(s.storycode) });
  }, [s]);

  if (q.isError) return <Page><ErrorState error={q.error} retry={() => q.refetch()} /></Page>;
  if (q.data === null) return <Page title={code}><NotFound what={code} /></Page>;
  if (!s) return <Page title={code}><StorySkeleton /></Page>;

  const lang = (i18n.resolvedLanguage || "en").split("-")[0];
  const desc = s.descriptions.find((d) => d.lang === lang) ?? s.descriptions.find((d) => d.lang === "en") ?? s.descriptions[0];
  const otherTitles = s.titles
    .filter((x) => x.title !== s.title && x.title !== s.original)
    .sort((a, b) => a.lang.localeCompare(b.lang));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.storycode);
      ui.toast(t("common.copied", { what: s.storycode }), "ok");
    } catch {
      /* presse-papiers refusé */
    }
  };

  return (
    <Page title={`${s.title || s.storycode} (${s.storycode})`}>
      <Breadcrumbs items={[{ label: t("nav.search"), to: routes.search() }, { label: s.storycode }]} />
      <article className="detail">
        <div className="detail__media">
          <div className="detail__media-sticky">
            <button className="detail__cover" onClick={() => s.img && setZoom(true)} disabled={!s.img} aria-label={t("story.zoom")}>
              <Cover img={s.img} alt={t("story.firstPage", { title: s.title })} quality="medium" seed={s.storycode} eager />
              {s.img && (
                <span className="detail__zoom" aria-hidden>
                  <Maximize2 size={16} />
                </span>
              )}
            </button>
            {s.img && <p className="detail__caption muted">{t("story.firstPageCaption")}</p>}
          </div>
        </div>

        <div className="detail__main">
          <div className="detail__eyebrow">
            <Code>{s.storycode}</Code>
            <KindTag kind={s.kind} />
            <IconButton label={t("common.copyCode")} size="sm" onClick={copy}>
              <Copy size={14} />
            </IconButton>
          </div>
          <h1 className="detail__title">{s.title || t("story.untitled")}</h1>
          {s.original && (
            <p className="detail__subtitle">
              {t("story.originalTitle")} <em>{s.original}</em>
            </p>
          )}

          {s.people.length > 0 && (
            <ul className="credits">
              {s.people.map((p) => (
                <li key={p.code}>
                  <Link to={routes.creator(p.code)} className="credit">
                    <Avatar name={p.name} code={p.code} size={36} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{rolesLabel(p.roles)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Facts
            items={[
              [t("story.firstPublished"), formatDate(s.date)],
              [t("story.kind"), kindLabel(s.kind)],
              [t("story.pages"), s.pages ? t("story.pagesN", { n: s.pages }) : ""],
              [t("story.rows"), s.rows ? t("story.rowsN", { count: s.rows }) : ""],
              [t("story.hero"), s.hero ? <Link className="link" to={routes.character(s.hero)}>{s.heroName ?? s.hero}</Link> : ""],
              [
                t("story.series"),
                s.subseries.length ? (
                  <span className="inline-list">
                    {s.subseries.map((x) => (
                      <Link key={x.code} className="link" to={routes.subseries(x.code)}>
                        {x.name}
                      </Link>
                    ))}
                  </span>
                ) : s.header ? (
                  s.header.title
                ) : (
                  ""
                ),
              ],
              [
                t("story.reach"),
                s.pubs ? t("story.reachN", { pubs: formatNumber(s.pubs), countries: formatNumber(s.countries), count: s.countries }) : "",
              ],
              [
                t("story.partOf"),
                s.partOf ? (
                  <Link className="link" to={routes.story(s.partOf.storycode)}>
                    {s.partOf.title || s.partOf.storycode}
                    {s.partOf.part ? `, ${t("story.part", { n: s.partOf.part })}` : ""}
                  </Link>
                ) : (
                  ""
                ),
              ],
            ]}
          />

          <div className="detail__actions">
            <a className="btn btn--secondary btn--md" href={inducksUrl.story(s.storycode)} target="_blank" rel="noreferrer">
              <span>{t("common.onInducks")}</span>
              <ExternalLink size={15} />
            </a>
            <Link className="btn btn--ghost btn--md" to={routes.search({ by: s.people[0]?.code })}>
              <BookMarked size={15} />
              <span>{t("story.moreBy", { name: s.people[0]?.name ?? "" })}</span>
            </Link>
          </div>

          {(desc || s.plot) && (
            <Section title={t("story.summary")}>
              <InducksText text={desc?.text ?? s.plot} className="lead-text" />
              {s.descriptions.length > 1 && (
                <Disclosure title={t("story.otherDescriptions", { count: s.descriptions.length - 1 })}>
                  <dl className="lang-list">
                    {s.descriptions
                      .filter((d) => d !== desc)
                      .map((d) => (
                        <div key={d.lang}>
                          <dt>{languageName(d.lang)}</dt>
                          <dd>
                            <InducksText text={d.text} />
                          </dd>
                        </div>
                      ))}
                  </dl>
                </Disclosure>
              )}
            </Section>
          )}

          {s.characters.length > 0 && (
            <Section title={t("story.characters", { count: s.characters.length })}>
              <ul className="tag-cloud">
                {s.characters.map((c) => (
                  <li key={c.code}>
                    <Link to={routes.character(c.code)} title={c.comment ?? undefined}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {s.parts.length > 0 && (
            <Section title={t("story.parts", { count: s.parts.length })}>
              <ol className="parts">
                {s.parts.map((p) => (
                  <li key={p.sid}>
                    <span className="parts__n num">{p.part}</span>
                    <Link className="link" to={routes.story(p.storycode)}>
                      {p.title || p.storycode}
                    </Link>
                    <Code>{p.storycode}</Code>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      </article>

      <Publications sid={s.sid} total={s.pubs} />

      {otherTitles.length > 0 && (
        <Section title={t("story.titles", { count: otherTitles.length })}>
          <dl className="titles">
            {otherTitles.map((x) => (
              <div key={x.lang}>
                <dt>{languageName(x.lang)}</dt>
                <dd>{x.title}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {s.refs.length > 0 && (
        <Section title={t("story.references", { count: s.refs.length })}>
          <ul className="ref-list">
            {s.refs.slice(0, 60).map((r) => (
              <li key={r.dir + r.sid + (r.reason ?? "")}>
                <span className={`ref-dir ref-dir--${r.dir}`}>{t(`story.ref.${r.dir}`)}</span>
                <Link className="link" to={routes.story(r.storycode)}>
                  {r.title || r.storycode}
                </Link>
                <Code>{r.storycode}</Code>
                {r.reason && r.reason !== "unknown" && <span className="muted">{r.reason}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {s.versions.length > 1 && (
        <Section title={t("story.versions", { count: s.versions.length })}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("story.version")}</th>
                  <th>{t("story.kind")}</th>
                  <th>{t("story.pages")}</th>
                  <th>{t("story.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {s.versions.map((v) => (
                  <tr key={v.svc}>
                    <td><Code>{v.svc}</Code></td>
                    <td>{kindLabel(v.kind)}</td>
                    <td className="num">{v.pages}</td>
                    <td>{v.what ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {(s.comment || s.links.length > 0) && (
        <Section title={t("story.notesTitle")}>
          {s.comment && <InducksText text={s.comment} />}
          {s.links.length > 0 && (
            <ul className="link-list">
              {s.links.map((l) => (
                <li key={l.url}>
                  <a className="link" href={l.url} target="_blank" rel="noreferrer">
                    {l.name ?? l.site}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Dialog open={zoom} onClose={() => setZoom(false)} title={s.title} size="xl" className="zoom">
        <div className="zoom__body">
          <img src={fullUrl(s.img) ?? undefined} alt={t("story.firstPage", { title: s.title })} referrerPolicy="no-referrer" />
        </div>
      </Dialog>
    </Page>
  );
}
