import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "motion/react";
import { Download, SlidersHorizontal, Search as SearchIcon, X } from "lucide-react";
import { Page, PageHead } from "../components/page";
import { StoryList, StoryRowSkeleton } from "../components/stories";
import { Autocomplete } from "../components/Autocomplete";
import { Button } from "../components/ui/Button";
import { Chip, Field, Input, Pager, Segmented, Select, Toggle } from "../components/ui/Controls";
import { Sheet } from "../components/ui/Overlay";
import { Empty, ErrorState } from "../components/ui/States";
import { hasCriteria, searchAllSids, searchStories, type SearchFilters, type SortKey } from "../data/search";
import { exactStoryCode, suggestCharacters, suggestPeople } from "../data/omni";
import { countries } from "../data/publications";
import { characterNames, personNames } from "../data/names";
import { storyCards } from "../data/stories";
import { collection } from "../lib/collection";
import { formatNumber } from "../lib/format";
import { countryName, KINDS, kindLabel } from "../lib/inducks";
import { ui } from "../lib/ui";
import { routes } from "../lib/routes";

const LIMIT = 30;

type Params = URLSearchParams;

function readFilters(p: Params, ownedSids: number[]): SearchFilters {
  const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean);
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  const owned = p.get("owned");
  return {
    q: p.get("q") ?? "",
    inDescriptions: p.get("desc") === "1",
    kinds: list("kind"),
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    characters: list("char"),
    creators: list("by").map((x) => {
      const [code, role] = x.split(":");
      return { code, role: (role as "write" | "draw") || "any" };
    }),
    publishedIn: p.get("in") ?? undefined,
    notPublishedIn: p.get("notin") ?? undefined,
    pagesMin: num("pmin"),
    pagesMax: num("pmax"),
    owned: owned === "only" || owned === "missing" ? owned : undefined,
    ownedSids: owned ? ownedSids : undefined,
    sort: (p.get("sort") as SortKey) || undefined,
  };
}

function useNames(f: SearchFilters) {
  const chars = f.characters ?? [];
  const people = (f.creators ?? []).map((c) => c.code);
  return useQuery({
    queryKey: ["filter-names", chars, people],
    queryFn: async () => {
      const [c, p] = await Promise.all([characterNames(chars), personNames(people)]);
      return { c, p };
    },
    staleTime: Infinity,
    enabled: chars.length + people.length > 0,
  });
}

function Filters({ params, set }: { params: Params; set: (patch: Record<string, string | null>) => void }) {
  const { t } = useTranslation();
  const all = useQuery({ queryKey: ["countries"], queryFn: countries, staleTime: Infinity });
  const owned = collection.use((c) => c.stories.length);
  const kinds = (params.get("kind") ?? "").split(",").filter(Boolean);
  const chars = (params.get("char") ?? "").split(",").filter(Boolean);
  const by = (params.get("by") ?? "").split(",").filter(Boolean);
  const [role, setRole] = useState<"any" | "write" | "draw">("any");

  const countryOptions = useMemo(
    () =>
      (all.data ?? [])
        .map((c) => ({ code: c.code, name: countryName(c.code, c.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [all.data],
  );

  const toggleKind = (k: string) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    set({ kind: next.join(",") || null });
  };

  return (
    <div className="filters">
      <Toggle
        checked={params.get("desc") === "1"}
        onChange={(v) => set({ desc: v ? "1" : null })}
        label={t("search.inDescriptions")}
        hint={t("search.inDescriptionsHint")}
      />

      <fieldset className="filters__group">
        <legend>{t("search.kind")}</legend>
        <div className="check-grid">
          {KINDS.filter((k) => !["P", "L", "q"].includes(k)).map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={kinds.includes(k)} onChange={() => toggleKind(k)} />
              <span>{kindLabel(k)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="filters__group">
        <legend>{t("search.characters")}</legend>
        <Autocomplete
          label={t("search.addCharacter")}
          placeholder={t("search.addCharacter")}
          queryKey="char"
          load={async (q) =>
            (await suggestCharacters(q)).map((c) => ({
              value: c.code,
              label: c.name,
              sub: t("counts.stories", { count: c.stories, n: formatNumber(c.stories) }),
            }))
          }
          onPick={(s) => !chars.includes(s.value) && set({ char: [...chars, s.value].join(",") })}
        />
      </fieldset>

      <fieldset className="filters__group">
        <legend>{t("search.creators")}</legend>
        <Segmented
          label={t("search.role")}
          value={role}
          onChange={setRole}
          items={[
            { value: "any", label: t("search.roleAny") },
            { value: "write", label: t("search.roleWrite") },
            { value: "draw", label: t("search.roleDraw") },
          ]}
        />
        <Autocomplete
          label={t("search.addCreator")}
          placeholder={t("search.addCreator")}
          queryKey="person"
          load={async (q) =>
            (await suggestPeople(q)).map((p) => ({
              value: p.code,
              label: p.name,
              sub: t("counts.stories", { count: p.stories ?? 0, n: formatNumber(p.stories ?? 0) }),
            }))
          }
          onPick={(s) => {
            const entry = role === "any" ? s.value : `${s.value}:${role}`;
            if (!by.some((b) => b.split(":")[0] === s.value)) set({ by: [...by, entry].join(",") });
          }}
        />
      </fieldset>

      <fieldset className="filters__group filters__row">
        <legend>{t("search.period")}</legend>
        <Field label={t("search.from")}>
          <Input
            inputMode="numeric"
            placeholder="1938"
            value={params.get("from") ?? ""}
            onChange={(e) => set({ from: e.target.value.replace(/\D/g, "").slice(0, 4) || null })}
          />
        </Field>
        <Field label={t("search.to")}>
          <Input
            inputMode="numeric"
            placeholder="2026"
            value={params.get("to") ?? ""}
            onChange={(e) => set({ to: e.target.value.replace(/\D/g, "").slice(0, 4) || null })}
          />
        </Field>
      </fieldset>

      <fieldset className="filters__group filters__row">
        <legend>{t("search.pages")}</legend>
        <Field label={t("search.min")}>
          <Input
            inputMode="numeric"
            value={params.get("pmin") ?? ""}
            onChange={(e) => set({ pmin: e.target.value.replace(/\D/g, "").slice(0, 3) || null })}
          />
        </Field>
        <Field label={t("search.max")}>
          <Input
            inputMode="numeric"
            value={params.get("pmax") ?? ""}
            onChange={(e) => set({ pmax: e.target.value.replace(/\D/g, "").slice(0, 3) || null })}
          />
        </Field>
      </fieldset>

      <fieldset className="filters__group">
        <legend>{t("search.publication")}</legend>
        <Field label={t("search.publishedIn")}>
          <Select value={params.get("in") ?? ""} onChange={(e) => set({ in: e.target.value || null })}>
            <option value="">{t("search.anyCountry")}</option>
            {countryOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("search.notPublishedIn")} hint={t("search.notPublishedInHint")}>
          <Select value={params.get("notin") ?? ""} onChange={(e) => set({ notin: e.target.value || null })}>
            <option value="">{t("search.noCountry")}</option>
            {countryOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <fieldset className="filters__group">
        <legend>{t("search.collection")}</legend>
        {owned ? (
          <Segmented
            label={t("search.collection")}
            value={params.get("owned") ?? "all"}
            onChange={(v) => set({ owned: v === "all" ? null : v })}
            items={[
              { value: "all", label: t("search.ownedAll") },
              { value: "only", label: t("search.ownedOnly") },
              { value: "missing", label: t("search.ownedMissing") },
            ]}
          />
        ) : (
          <p className="field__hint">{t("search.noCollection")}</p>
        )}
      </fieldset>
    </div>
  );
}

function ActiveChips({ params, set, f }: { params: Params; set: (patch: Record<string, string | null>) => void; f: SearchFilters }) {
  const { t } = useTranslation();
  const names = useNames(f);
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const kinds = f.kinds ?? [];
  kinds.forEach((k) =>
    chips.push({ key: `k${k}`, label: kindLabel(k), remove: () => set({ kind: kinds.filter((x) => x !== k).join(",") || null }) }),
  );
  (f.characters ?? []).forEach((c) =>
    chips.push({
      key: `c${c}`,
      label: names.data?.c.get(c) ?? c,
      remove: () => set({ char: (f.characters ?? []).filter((x) => x !== c).join(",") || null }),
    }),
  );
  (f.creators ?? []).forEach((p) =>
    chips.push({
      key: `p${p.code}`,
      label:
        (names.data?.p.get(p.code) ?? p.code) +
        (p.role && p.role !== "any" ? ` (${t(p.role === "write" ? "search.roleWrite" : "search.roleDraw").toLowerCase()})` : ""),
      remove: () =>
        set({
          by:
            (params.get("by") ?? "")
              .split(",")
              .filter((x) => x && x.split(":")[0] !== p.code)
              .join(",") || null,
        }),
    }),
  );
  if (f.from || f.to)
    chips.push({ key: "period", label: `${f.from ?? "…"}–${f.to ?? "…"}`, remove: () => set({ from: null, to: null }) });
  if (f.pagesMin || f.pagesMax)
    chips.push({
      key: "pages",
      label: t("search.pagesChip", { min: f.pagesMin ?? "0", max: f.pagesMax ?? "∞" }),
      remove: () => set({ pmin: null, pmax: null }),
    });
  if (f.publishedIn)
    chips.push({ key: "in", label: t("search.inChip", { c: countryName(f.publishedIn) }), remove: () => set({ in: null }) });
  if (f.notPublishedIn)
    chips.push({ key: "notin", label: t("search.notinChip", { c: countryName(f.notPublishedIn) }), remove: () => set({ notin: null }) });
  if (f.owned)
    chips.push({ key: "owned", label: t(f.owned === "only" ? "search.ownedOnly" : "search.ownedMissing"), remove: () => set({ owned: null }) });
  if (f.inDescriptions)
    chips.push({ key: "desc", label: t("search.inDescriptions"), remove: () => set({ desc: null }) });

  if (!chips.length) return null;
  return (
    <div className="chips">
      <AnimatePresence initial={false}>
        {chips.map((c) => (
          <Chip key={c.key} onRemove={c.remove} removeLabel={t("search.removeFilter", { f: c.label })}>
            {c.label}
          </Chip>
        ))}
      </AnimatePresence>
      {chips.length > 1 && (
        <button
          className="chips__clear"
          onClick={() => set({ kind: null, char: null, by: null, from: null, to: null, pmin: null, pmax: null, in: null, notin: null, owned: null, desc: null })}
        >
          {t("search.clearFilters")}
        </button>
      )}
    </div>
  );
}

function exportCsv(rows: string[][], name: string) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function Search() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const ownedSids = collection.use((c) => c.stories);
  const f = useMemo(() => readFilters(params, ownedSids), [params, ownedSids]);
  const offset = Number(params.get("page") ?? 1) * LIMIT - LIMIT;
  const [draft, setDraft] = useState(f.q ?? "");
  const [sheet, setSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => setDraft(f.q ?? ""), [f.q]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: !("q" in patch) });
  };

  const active = hasCriteria(f);
  const result = useQuery({
    queryKey: ["search", f, offset],
    queryFn: () => searchStories(f, offset, LIMIT),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    // Un code d'histoire exact mène droit à sa fiche.
    if (q && /\d/.test(q)) {
      const code = await exactStoryCode(q);
      if (code && !hasCriteria({ ...f, q: "" })) {
        navigate(routes.story(code));
        return;
      }
    }
    set({ q: q || null });
  };

  const filterCount =
    (f.kinds?.length ?? 0) +
    (f.characters?.length ?? 0) +
    (f.creators?.length ?? 0) +
    (f.from || f.to ? 1 : 0) +
    (f.pagesMin || f.pagesMax ? 1 : 0) +
    (f.publishedIn ? 1 : 0) +
    (f.notPublishedIn ? 1 : 0) +
    (f.owned ? 1 : 0) +
    (f.inDescriptions ? 1 : 0);

  const doExport = async () => {
    setExporting(true);
    try {
      const sids = await searchAllSids(f, 3000);
      const cards = await storyCards(sids);
      exportCsv(
        [
          ["storycode", "title", "original_title", "kind", "pages", "first_publication", "writers", "artists", "publications"],
          ...cards.map((c) => [
            c.storycode,
            c.title,
            c.original ?? "",
            c.kind ?? "",
            c.pages,
            c.date ?? "",
            c.writers.map((w) => w.name).join("; "),
            c.artists.map((w) => w.name).join("; "),
            String(c.pubs),
          ]),
        ],
        "inducks-search.csv",
      );
      ui.toast(t("search.exported", { n: formatNumber(cards.length) }), "ok");
    } catch (err) {
      ui.toast(String(err), "error");
    } finally {
      setExporting(false);
    }
  };

  const ownedSet = useMemo(() => new Set(ownedSids), [ownedSids]);
  const total = result.data?.total ?? 0;

  return (
    <Page title={f.q ? t("search.titleFor", { q: f.q }) : t("search.title")} wide>
      <PageHead title={t("search.title")}>
        <form className="search-box" onSubmit={submit} role="search">
          <SearchIcon size={20} aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            enterKeyHint="search"
          />
          {draft && (
            <button type="button" className="search-box__clear" aria-label={t("common.clear")} onClick={() => { setDraft(""); set({ q: null }); }}>
              <X size={16} />
            </button>
          )}
          <Button type="submit" variant="primary">
            {t("search.submit")}
          </Button>
        </form>
      </PageHead>

      <div className="search-layout">
        <aside className="search-layout__filters" aria-label={t("search.filters")}>
          <h2 className="filters__title">{t("search.filters")}</h2>
          <Filters params={params} set={set} />
        </aside>

        <div className="search-layout__results">
          <div className="results-bar">
            <p className="results-bar__count" aria-live="polite">
              {result.data
                ? t(result.data.capped ? "search.countCapped" : "search.count", {
                    count: total,
                    n: formatNumber(total),
                  })
                : " "}
            </p>
            <div className="results-bar__tools">
              <Button
                className="filters-open"
                icon={<SlidersHorizontal size={16} />}
                onClick={() => setSheet(true)}
              >
                {t("search.filters")}
                {filterCount > 0 && <span className="badge-count">{filterCount}</span>}
              </Button>
              <Select
                aria-label={t("search.sort")}
                value={f.sort ?? (f.q ? "relevance" : "date_desc")}
                onChange={(e) => set({ sort: e.target.value })}
              >
                <option value="relevance">{t("search.sorts.relevance")}</option>
                <option value="date_desc">{t("search.sorts.date_desc")}</option>
                <option value="date_asc">{t("search.sorts.date_asc")}</option>
                <option value="pubs">{t("search.sorts.pubs")}</option>
                <option value="pages">{t("search.sorts.pages")}</option>
              </Select>
              {total > 0 && (
                <Button icon={<Download size={16} />} onClick={doExport} disabled={exporting} title={t("search.export")}>
                  <span className="hide-sm">{t("search.exportShort")}</span>
                </Button>
              )}
            </div>
          </div>

          <ActiveChips params={params} set={set} f={f} />

          {!active && result.data && <p className="results-hint muted">{t("search.browseHint")}</p>}

          {result.isError ? (
            <ErrorState error={result.error} retry={() => result.refetch()} />
          ) : !result.data ? (
            <StoryRowSkeleton n={8} />
          ) : result.data.sids.length === 0 ? (
            <Empty title={t("search.noResults")}>{t("search.noResultsHint")}</Empty>
          ) : (
            <div className={result.isPlaceholderData ? "is-stale" : undefined}>
              <StoryList sids={result.data.sids} ownedSet={ownedSet} />
              <Pager
                offset={offset}
                limit={LIMIT}
                total={total}
                capped={result.data.capped}
                onChange={(o) => {
                  set({ page: String(o / LIMIT + 1) });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t("search.filters")}
        footer={
          <Button variant="primary" onClick={() => setSheet(false)} className="btn--block">
            {result.data ? t("search.showResults", { count: total, n: formatNumber(total) }) : t("common.close")}
          </Button>
        }
      >
        <Filters params={params} set={set} />
      </Sheet>
    </Page>
  );
}
