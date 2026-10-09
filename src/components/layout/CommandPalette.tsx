import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ArrowUpRight, Bird, BookOpen, Clock, Layers, Library, Newspaper, PenLine, Search, X } from "lucide-react";
import { Dialog } from "../ui/Overlay";
import { Cover } from "../ui/Media";
import { Spinner } from "../ui/States";
import { CountryTag } from "../ui/Badges";
import { omniSearch } from "../../data/omni";
import { ui, useUi, recentVisits } from "../../lib/ui";
import { routes } from "../../lib/routes";
import { formatNumber, year } from "../../lib/format";
import { countryName, kindLabel } from "../../lib/inducks";
import { highlight, norm, packCode } from "../../lib/text";

interface Item {
  key: string;
  href: string;
  /** Le nom correspond exactement à la saisie : son groupe passe en tête. */
  exact?: boolean;
  title: ReactNode;
  sub?: ReactNode;
  media?: ReactNode;
  group: string;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Hl({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlight(text, q).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useUi((s) => s.palette);
  const initial = useUi((s) => s.paletteQuery);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(q.trim(), 140);

  useEffect(() => {
    if (open) {
      setQ(initial);
      setActive(0);
    }
  }, [open, initial]);

  const res = useQuery({
    queryKey: ["omni", debounced],
    queryFn: () => omniSearch(debounced),
    enabled: open && debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });

  const items: Item[] = useMemo(() => {
    if (!debounced) {
      return recentVisits().map((v) => ({
        key: v.href,
        href: v.href,
        title: v.label,
        sub: v.sub,
        group: "recent",
        media: <Clock size={16} />,
      }));
    }
    const d = res.data;
    if (!d) return [];
    const out: Item[] = [];
    for (const s of d.stories) {
      out.push({
        key: `s-${s.sid}`,
        href: routes.story(s.storycode),
        exact: packCode(s.storycode) === packCode(debounced) || norm(s.title) === norm(debounced),
        group: "stories",
        title: <Hl text={s.title || s.storycode} q={debounced} />,
        sub: (
          <>
            <span className="code">{s.storycode}</span>
            {[kindLabel(s.kind), s.writers.concat(s.artists).map((p) => p.name).filter((n, i, a) => a.indexOf(n) === i).slice(0, 2).join(", "), year(s.date)]
              .filter(Boolean)
              .map((x, i) => (
                <span key={i}>{x}</span>
              ))}
          </>
        ),
        media: <Cover img={s.img} alt="" seed={s.storycode} className="palette__thumb" />,
      });
    }
    for (const i of d.issues) {
      out.push({
        key: `i-${i.issuecode}`,
        href: routes.issue(i.issuecode, i.publicationcode),
        exact: true,
        group: "issues",
        title: `${i.publicationTitle} ${i.number}`,
        sub: (
          <>
            <span className="code">{i.issuecode}</span>
            {year(i.date) && <span>{year(i.date)}</span>}
          </>
        ),
        media: <Cover img={i.img} alt="" seed={i.issuecode} className="palette__thumb" />,
      });
    }
    for (const p of d.people) {
      out.push({
        key: `p-${p.code}`,
        href: routes.creator(p.code),
        exact: norm(p.name) === norm(debounced) || p.code.toLowerCase() === debounced.toLowerCase(),
        group: "people",
        title: <Hl text={p.name} q={debounced} />,
        sub: (
          <>
            {p.nationality && <span>{countryName(p.nationality)}</span>}
            <span>{t("counts.stories", { count: p.stories ?? 0, n: formatNumber(p.stories ?? 0) })}</span>
          </>
        ),
        media: <PenLine size={16} />,
      });
    }
    for (const c of d.characters) {
      out.push({
        key: `c-${c.code}`,
        href: routes.character(c.code),
        exact: norm(c.name) === norm(debounced),
        group: "characters",
        title: <Hl text={c.name} q={debounced} />,
        sub: <span>{t("counts.stories", { count: c.stories ?? 0, n: formatNumber(c.stories ?? 0) })}</span>,
        media: <Bird size={16} />,
      });
    }
    for (const p of d.publications) {
      out.push({
        key: `pub-${p.code}`,
        href: routes.publication(p.code),
        exact: norm(p.title) === norm(debounced),
        group: "publications",
        title: <Hl text={p.title} q={debounced} />,
        sub: (
          <>
            <CountryTag code={p.countrycode} />
            <span>{t("counts.issues", { count: p.issues, n: formatNumber(p.issues) })}</span>
          </>
        ),
        media: <Library size={16} />,
      });
    }
    for (const s of d.series) {
      out.push({
        key: `ser-${s.code}`,
        href: routes.subseries(s.code),
        exact: norm(s.name) === norm(debounced),
        group: "series",
        title: <Hl text={s.name} q={debounced} />,
        sub: <span>{t("counts.stories", { count: s.stories ?? 0, n: formatNumber(s.stories ?? 0) })}</span>,
        media: <Layers size={16} />,
      });
    }
    // Groupes contenant une correspondance exacte d'abord (« Don Rosa » est un auteur
    // avant d'être un mot dans des titres), l'ordre interne de chaque groupe est conservé.
    const groups = [...new Set(out.map((i) => i.group))];
    const rank = (g: string) => (out.some((i) => i.group === g && i.exact) ? 0 : 1);
    groups.sort((a, b) => rank(a) - rank(b));
    return groups.flatMap((g) => out.filter((i) => i.group === g));
  }, [debounced, res.data, t]);

  const all: Item[] = useMemo(
    () =>
      debounced
        ? [
            ...items,
            {
              key: "all",
              href: routes.search({ q: debounced }),
              group: "more",
              title: t("palette.allResults", { q: debounced }),
              media: <Search size={16} />,
            },
          ]
        : items,
    [items, debounced, t],
  );

  useEffect(() => setActive(0), [debounced]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    ui.set({ palette: false });
    navigate(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(all.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!all.length && q.trim()) {
        ui.set({ palette: false });
        navigate(routes.search({ q: q.trim() }));
      } else go(all[active]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const groupIcon: Record<string, ReactNode> = {
    stories: <BookOpen size={14} />,
    issues: <Newspaper size={14} />,
  };

  let lastGroup = "";
  return (
    <Dialog open={open} onClose={() => ui.set({ palette: false })} bare size="lg" className="palette" labelledBy="palette-label">
      <div className="palette__bar">
        <Search size={20} className="palette__icon" aria-hidden />
        <label id="palette-label" className="sr-only" htmlFor="palette-input">
          {t("palette.label")}
        </label>
        <input
          id="palette-input"
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("palette.placeholder")}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={all.length > 0}
          aria-controls="palette-list"
          aria-activedescendant={all[active] ? `palette-item-${active}` : undefined}
        />
        {res.isFetching && <Spinner size={16} label={t("common.loading")} />}
        {q && (
          <button className="palette__clear" onClick={() => setQ("")} aria-label={t("common.clear")}>
            <X size={16} />
          </button>
        )}
        <kbd className="palette__esc">Esc</kbd>
      </div>
      <div className="palette__list" id="palette-list" role="listbox" ref={listRef}>
        {!debounced && !items.length && (
          <div className="palette__hint">
            <p>{t("palette.hint")}</p>
            <div className="palette__examples">
              {["Only a Poor Old Man", "Don Rosa", "Picsou Magazine 300", "W OS 386-02", "Gyro"].map((ex) => (
                <button key={ex} onClick={() => setQ(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {debounced && res.data && items.length === 0 && !res.isFetching && (
          <div className="palette__hint">
            <p>{t("palette.nothing", { q: debounced })}</p>
          </div>
        )}
        {all.map((item, index) => {
          const header = item.group !== lastGroup && item.group !== "more";
          lastGroup = item.group;
          return (
            <div key={item.key}>
              {header && (
                <div className="palette__group">
                  {groupIcon[item.group]}
                  {t(`palette.groups.${item.group}`)}
                </div>
              )}
              <motion.button
                id={`palette-item-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === active}
                className={`palette__item${index === active ? " is-active" : ""}${item.group === "more" ? " palette__item--more" : ""}`}
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
                initial={false}
              >
                <span className="palette__media">{item.media}</span>
                <span className="palette__text">
                  <span className="palette__title">{item.title}</span>
                  {item.sub && <span className="palette__sub">{item.sub}</span>}
                </span>
                {index === active && <ArrowUpRight size={16} className="palette__go" aria-hidden />}
              </motion.button>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
