import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookmarkCheck, BookmarkPlus, ChevronLeft, ChevronRight, ExternalLink, Maximize2 } from "lucide-react";
import { Breadcrumbs, Facts, Page, Section } from "../components/page";
import { InducksText } from "../components/InducksText";
import { Cover } from "../components/ui/Media";
import { Code, CountryTag } from "../components/ui/Badges";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Overlay";
import { ErrorState, NotFound, Skeleton } from "../components/ui/States";
import { issueDetail, type TocEntry } from "../data/issues";
import { decodeSegment, inducksUrl, routes } from "../lib/routes";
import { formatDate, formatNumber } from "../lib/format";
import { countryName, fullUrl, kindLabel, rolesLabel } from "../lib/inducks";
import { collection } from "../lib/collection";
import { recordVisit, ui } from "../lib/ui";

const NOTE_KEYS = ["changes", "cut", "minor", "missing", "mirrored", "sideways", "uncertain", "printedcode", "hero", "comment"] as const;

function TocNotes({ notes }: { notes: TocEntry["notes"] }) {
  const { t } = useTranslation();
  if (!notes) return null;
  const items = NOTE_KEYS.filter((k) => notes[k] !== undefined && notes[k] !== null && notes[k] !== "");
  if (!items.length) return null;
  return (
    <ul className="toc-notes">
      {items.map((k) => (
        <li key={k}>
          {k === "comment" ? (
            <InducksText text={String(notes[k])} />
          ) : notes[k] === 1 ? (
            t(`toc.notes.${k}`)
          ) : (
            <>
              <span className="muted">{t(`toc.notes.${k}`)}</span> {String(notes[k])}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function Toc({ toc }: { toc: TocEntry[] }) {
  const { t } = useTranslation();
  return (
    <ol className="toc">
      {toc.map((e) => (
        <li key={e.pos + e.entry} className={`toc__row${e.kind === "c" ? " toc__row--cover" : ""}`}>
          <span className="toc__pos num">{e.pos || "·"}</span>
          <div className="toc__thumb">
            {e.storycode ? (
              <Link to={routes.story(e.storycode)} tabIndex={-1} aria-hidden>
                <Cover img={e.img} alt="" seed={e.storycode} />
              </Link>
            ) : (
              <Cover img={e.img} alt="" seed={e.entry} />
            )}
          </div>
          <div className="toc__main">
            <h3 className="toc__title">
              {e.storycode ? (
                <Link to={routes.story(e.storycode)}>{e.title || kindLabel(e.kind) || t("story.untitled")}</Link>
              ) : (
                e.title || kindLabel(e.kind) || t("story.untitled")
              )}
            </h3>
            {e.originalTitle && <p className="toc__original">{e.originalTitle}</p>}
            <p className="toc__meta">
              {e.storycode && <Code>{e.storycode}</Code>}
              {e.kind && e.title && <span>{kindLabel(e.kind)}</span>}
              {e.pages && <span>{t("story.pagesShort", { n: e.pages })}</span>}
              {e.part && <span>{t("story.part", { n: e.part })}</span>}
            </p>
            {e.people.length > 0 && (
              <p className="toc__people">
                {e.people.map((p, i) => (
                  <span key={p.code}>
                    {i > 0 && ", "}
                    <Link className="person-link" to={routes.creator(p.code)}>
                      {p.name}
                    </Link>
                    <span className="muted"> ({rolesLabel(p.roles).toLowerCase()})</span>
                  </span>
                ))}
              </p>
            )}
            <TocNotes notes={e.notes} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function Issue() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const pub = `${decodeSegment(params.country ?? "")}/${decodeSegment(params.pub ?? "")}`;
  const number = decodeSegment(params.number ?? "");
  const [zoom, setZoom] = useState(false);
  const q = useQuery({
    queryKey: ["issue", pub, number, i18n.resolvedLanguage],
    queryFn: () => issueDetail(pub, number),
    staleTime: Infinity,
  });
  const owned = collection.use((c) => (q.data ? c.issues.includes(q.data.issuecode) : false));
  const d = q.data;

  useEffect(() => {
    if (d)
      recordVisit({
        kind: "issue",
        code: d.issuecode,
        label: `${d.publicationTitle} ${d.number}`,
        sub: d.issuecode,
        href: routes.issue(d.issuecode, d.publicationcode),
      });
  }, [d]);

  if (q.isError) return <Page><ErrorState error={q.error} retry={() => q.refetch()} /></Page>;
  if (q.data === null) return <Page title={`${pub} ${number}`}><NotFound what={`${pub} ${number}`} /></Page>;
  if (!d) {
    return (
      <Page>
        <div className="detail">
          <div className="detail__media"><Skeleton w="100%" h={380} r={3} /></div>
          <div className="detail__main"><Skeleton w="60%" h={36} /><Skeleton w="100%" h={200} /></div>
        </div>
      </Page>
    );
  }

  const toggleOwned = () => {
    const issues = collection.get().issues;
    if (owned) {
      collection.set({ issues: issues.filter((x) => x !== d.issuecode), analyzed: null, updated: new Date().toISOString() });
      ui.toast(t("collection.removed", { what: `${d.publicationTitle} ${d.number}` }));
    } else {
      collection.set({ issues: [...issues, d.issuecode], analyzed: null, updated: new Date().toISOString() });
      ui.toast(t("collection.added", { what: `${d.publicationTitle} ${d.number}` }), "ok");
    }
  };

  const jobs = ["i", "t", "l", "c"]
    .map((job) => ({ job, people: d.jobs.filter((j) => j.job === job) }))
    .filter((x) => x.people.length);

  return (
    <Page title={`${d.publicationTitle} ${d.number}`}>
      <Breadcrumbs
        items={[
          { label: t("nav.publications"), to: routes.countries() },
          { label: countryName(d.countrycode), to: routes.country(d.countrycode) },
          { label: d.publicationTitle, to: routes.publication(d.publicationcode) },
          { label: d.number },
        ]}
      />
      <article className="detail">
        <div className="detail__media">
          <div className="detail__media-sticky">
            <button className="detail__cover" onClick={() => d.img && setZoom(true)} disabled={!d.img} aria-label={t("story.zoom")}>
              <Cover img={d.img} alt={t("issue.cover", { title: `${d.publicationTitle} ${d.number}` })} quality="medium" seed={d.issuecode} eager />
              {d.img && (
                <span className="detail__zoom" aria-hidden>
                  <Maximize2 size={16} />
                </span>
              )}
            </button>
            <div className="issue-nav">
              {d.prev ? (
                <Link className="btn btn--secondary btn--sm" to={routes.issue(d.prev.issuecode, d.publicationcode)}>
                  <ChevronLeft size={15} />
                  <span>{d.prev.number}</span>
                </Link>
              ) : (
                <span />
              )}
              {d.next && (
                <Link className="btn btn--secondary btn--sm" to={routes.issue(d.next.issuecode, d.publicationcode)}>
                  <span>{d.next.number}</span>
                  <ChevronRight size={15} />
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="detail__main">
          <div className="detail__eyebrow">
            <CountryTag code={d.countrycode} link />
            <Code>{d.issuecode}</Code>
          </div>
          <h1 className="detail__title">
            <Link to={routes.publication(d.publicationcode)} className="detail__pub">
              {d.publicationTitle}
            </Link>{" "}
            <span className="num">{d.number}</span>
          </h1>
          {d.title && <p className="detail__subtitle">{d.title}</p>}

          <Facts
            items={[
              [t("issue.date"), formatDate(d.date)],
              [t("issue.pages"), d.pages ? formatNumber(d.pages) : ""],
              [t("issue.price"), d.price],
              [
                t("issue.publisher"),
                d.publisherName && d.publisherid ? (
                  <Link className="link" to={routes.publisher(d.publisherid)}>
                    {d.publisherName}
                  </Link>
                ) : (
                  ""
                ),
              ],
              [t("issue.size"), d.size],
              [t("issue.printrun"), d.printrun],
              [t("issue.attached"), d.attached],
              [t("issue.contents"), d.entries ? t("issue.entries", { count: d.entries, n: formatNumber(d.entries) }) : ""],
              ...jobs.map(
                (j) =>
                  [
                    t(`issue.jobs.${j.job}`),
                    <span className="inline-list" key={j.job}>
                      {j.people.map((p) => (
                        <Link key={p.code} className="link" to={routes.creator(p.code)}>
                          {p.name}
                        </Link>
                      ))}
                    </span>,
                  ] as [string, React.ReactNode],
              ),
            ]}
          />
          <div className="detail__actions">
            <Button
              variant={owned ? "marker" : "primary"}
              icon={owned ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
              onClick={toggleOwned}
              aria-pressed={owned}
            >
              {owned ? t("collection.inMine") : t("collection.add")}
            </Button>
            <a className="btn btn--ghost btn--md" href={inducksUrl.issue(d.issuecode)} target="_blank" rel="noreferrer">
              <span>{t("common.onInducks")}</span>
              <ExternalLink size={15} />
            </a>
          </div>
          {d.comment && <InducksText text={d.comment} className="detail__comment" />}
        </div>
      </article>

      <Section title={t("issue.toc", { count: d.toc.length })}>
        {d.toc.length ? <Toc toc={d.toc} /> : <p className="muted">{t("issue.notIndexed")}</p>}
      </Section>

      {(d.collects.length > 0 || d.collectedIn.length > 0) && (
        <Section title={t("issue.related")}>
          {d.collects.length > 0 && (
            <>
              <h3 className="sub-title">{t("issue.collects")}</h3>
              <ul className="link-list">
                {d.collects.map((c) => (
                  <li key={c.issuecode}>
                    <Link className="link" to={routes.issue(c.issuecode, c.publicationcode)}>
                      {c.title ? `${c.title} ${c.issuecode.slice((c.publicationcode ?? "").length).trim()}` : c.issuecode}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.collectedIn.length > 0 && (
            <>
              <h3 className="sub-title">{t("issue.collectedIn")}</h3>
              <ul className="link-list">
                {d.collectedIn.map((c) => (
                  <li key={c.issuecode}>
                    <Link className="link" to={routes.issue(c.issuecode, c.publicationcode)}>
                      {c.title ? `${c.title} ${c.issuecode.slice((c.publicationcode ?? "").length).trim()}` : c.issuecode}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      <Dialog open={zoom} onClose={() => setZoom(false)} title={`${d.publicationTitle} ${d.number}`} size="xl" className="zoom">
        <div className="zoom__body">
          <img src={fullUrl(d.img) ?? undefined} alt={t("issue.cover", { title: `${d.publicationTitle} ${d.number}` })} referrerPolicy="no-referrer" />
        </div>
      </Dialog>
    </Page>
  );
}
