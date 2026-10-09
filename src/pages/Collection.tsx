import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Download, FileUp, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { Page, PageHead, Section } from "../components/page";
import { Cover } from "../components/ui/Media";
import { CountryTag } from "../components/ui/Badges";
import { Button, ButtonLink } from "../components/ui/Button";
import { Dialog } from "../components/ui/Overlay";
import { Empty, ErrorState, Skeleton } from "../components/ui/States";
import { collection, parseCollection } from "../lib/collection";
import { issueTiles, type IssueTile } from "../data/issues";
import { fanOut, placeholders } from "../db/client";
import { routes } from "../lib/routes";
import { formatNumber, formatDate } from "../lib/format";
import { ui } from "../lib/ui";

async function analyze(issues: string[], onProgress: (done: number) => void): Promise<number[]> {
  const sids = new Set<number>();
  const step = 120;
  for (let i = 0; i < issues.length; i += step) {
    const part = issues.slice(i, i + step);
    const r = await fanOut<{ sid: number }>(
      (keys) => ({
        sql: `SELECT DISTINCT sid FROM toc WHERE issuecode IN (${placeholders(keys.length)}) AND sid IS NOT NULL`,
        params: keys as string[],
      }),
      part,
    );
    r.forEach((x) => sids.add(x.sid));
    onProgress(Math.min(issues.length, i + step));
  }
  return [...sids].sort((a, b) => a - b);
}

function Import({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseCollection(text), [text]);
  const save = (mode: "replace" | "merge") => {
    const current = collection.get().issues;
    const issues = mode === "merge" ? [...new Set([...current, ...parsed])] : parsed;
    collection.set({ issues, stories: [], analyzed: null, updated: new Date().toISOString() });
    ui.toast(t("collection.imported", { n: formatNumber(issues.length) }), "ok");
    onDone();
  };
  return (
    <div className="import">
      <p className="muted">{t("collection.importHelp")}</p>
      <textarea
        className="input textarea"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"fr^PM  272^^\nfr^JM 3000^^\nit^TL 2700^^"}
        aria-label={t("collection.paste")}
        spellCheck={false}
      />
      <div className="import__bar">
        <input
          ref={file}
          type="file"
          accept=".txt,.isv,.csv,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
          }}
        />
        <Button icon={<FileUp size={16} />} onClick={() => file.current?.click()}>
          {t("collection.fromFile")}
        </Button>
        <span className="muted num">{parsed.length ? t("collection.detected", { count: parsed.length, n: formatNumber(parsed.length) }) : ""}</span>
        <span className="spacer" />
        {collection.get().issues.length > 0 && (
          <Button disabled={!parsed.length} onClick={() => save("merge")}>
            {t("collection.merge")}
          </Button>
        )}
        <Button variant="primary" icon={<Upload size={16} />} disabled={!parsed.length} onClick={() => save("replace")}>
          {collection.get().issues.length > 0 ? t("collection.replace") : t("collection.import")}
        </Button>
      </div>
    </div>
  );
}

export default function Collection() {
  const { t } = useTranslation();
  const state = collection.use((c) => c);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [filter, setFilter] = useState("");

  const tiles = useQuery({
    queryKey: ["collection-tiles", state.issues],
    queryFn: () => issueTiles(state.issues),
    enabled: state.issues.length > 0,
    staleTime: Infinity,
  });

  // Analyse automatique après import : les histoires possédées servent au filtre de recherche.
  useEffect(() => {
    if (!state.issues.length || state.analyzed || progress !== null) return;
    let cancelled = false;
    setProgress(0);
    analyze(state.issues, (d) => !cancelled && setProgress(d))
      .then((stories) => {
        if (cancelled) return;
        collection.set({ stories, analyzed: new Date().toISOString() });
        ui.toast(t("collection.analyzed", { n: formatNumber(stories.length) }), "ok");
      })
      .catch((err) => ui.toast(String(err), "error"))
      // Toujours libérer la barre : l'enregistrement du résultat relance l'effet (et
      // annule ce tour) avant que cette promesse ne se termine.
      .finally(() => setProgress(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.issues, state.analyzed]);

  const groups = useMemo(() => {
    const by = new Map<string, { title: string; list: IssueTile[] }>();
    for (const it of tiles.data ?? []) {
      const g = by.get(it.publicationcode) ?? { title: it.publicationTitle ?? it.publicationcode, list: [] };
      g.list.push(it);
      by.set(it.publicationcode, g);
    }
    for (const g of by.values()) g.list.sort((a, b) => (a.issuecode < b.issuecode ? -1 : a.issuecode > b.issuecode ? 1 : 0));
    const f = filter.toLowerCase();
    return [...by.entries()]
      .filter(([code, g]) => !f || g.title.toLowerCase().includes(f) || code.toLowerCase().includes(f))
      .sort((a, b) => b[1].list.length - a[1].list.length);
  }, [tiles.data, filter]);

  const exportFile = () => {
    const text = state.issues
      .map((code) => {
        const i = code.indexOf("/");
        return `${code.slice(0, i)}^${code.slice(i + 1)}^^`;
      })
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "collection-inducks.txt";
    a.click();
  };

  const missing = state.issues.length - (tiles.data?.length ?? state.issues.length);

  if (!state.issues.length) {
    return (
      <Page title={t("collection.title")}>
        <PageHead title={t("collection.title")} lead={t("collection.lead")} />
        <Import onDone={() => undefined} />
      </Page>
    );
  }

  return (
    <Page title={t("collection.title")} wide>
      <PageHead
        title={t("collection.title")}
        lead={t("collection.summary", {
          issues: formatNumber(state.issues.length),
          pubs: formatNumber(groups.length),
          stories: formatNumber(state.stories.length),
        })}
        actions={
          <>
            <ButtonLink to={routes.search({ owned: "only" })} icon={<Search size={16} />} variant="primary">
              {t("collection.searchMine")}
            </ButtonLink>
            <Button icon={<Upload size={16} />} onClick={() => setImporting(true)}>
              {t("collection.import")}
            </Button>
          </>
        }
      />

      {progress !== null && (
        <div className="progress" role="status">
          <span>{t("collection.analyzing", { done: formatNumber(progress), total: formatNumber(state.issues.length) })}</span>
          <span className="progress__track">
            <motion.span animate={{ width: `${(100 * progress) / Math.max(1, state.issues.length)}%` }} transition={{ duration: 0.3 }} />
          </span>
        </div>
      )}

      <div className="toolbar">
        <input className="input" placeholder={t("collection.filter")} aria-label={t("collection.filter")} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="spacer" />
        <Button icon={<RefreshCw size={16} />} onClick={() => collection.set({ analyzed: null })} disabled={progress !== null}>
          {t("collection.reanalyze")}
        </Button>
        <Button icon={<Download size={16} />} onClick={exportFile}>
          {t("collection.export")}
        </Button>
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)}>
          {t("collection.clear")}
        </Button>
      </div>

      {missing > 0 && tiles.data && <p className="muted">{t("collection.unknown", { count: missing })}</p>}
      {tiles.isError && <ErrorState error={tiles.error} retry={() => tiles.refetch()} />}
      {!tiles.data && !tiles.isError && <Skeleton w="100%" h={300} />}

      {groups.map(([code, g]) => (
        <Section
          key={code}
          title={
            <Link to={routes.publication(code)} className="section__link">
              <CountryTag code={code.split("/")[0]} /> {g.title}
            </Link>
          }
          aside={<span className="num muted">{formatNumber(g.list.length)}</span>}
        >
          <div className="issue-grid issue-grid--compact">
            {g.list.map((it) => (
              <Link key={it.issuecode} to={routes.issue(it.issuecode, it.publicationcode)} className="issue-tile">
                <Cover img={it.img} alt="" seed={it.issuecode} />
                <span className="issue-tile__title num">{it.number}</span>
                <span className="issue-tile__date">{formatDate(it.date, "short")}</span>
              </Link>
            ))}
          </div>
        </Section>
      ))}

      {groups.length === 0 && tiles.data && <Empty title={t("collection.noMatch")} />}

      <Dialog open={importing} onClose={() => setImporting(false)} title={t("collection.import")} size="lg">
        <Import onDone={() => setImporting(false)} />
      </Dialog>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t("collection.clearTitle")} size="sm">
        <p>{t("collection.clearBody", { n: formatNumber(state.issues.length) })}</p>
        <div className="dialog__actions">
          <Button onClick={() => setConfirm(false)}>{t("common.cancel")}</Button>
          <Button
            variant="danger"
            onClick={() => {
              collection.set({ issues: [], stories: [], analyzed: null, updated: null });
              setConfirm(false);
              ui.toast(t("collection.cleared"));
            }}
          >
            {t("collection.clear")}
          </Button>
        </div>
      </Dialog>
    </Page>
  );
}
