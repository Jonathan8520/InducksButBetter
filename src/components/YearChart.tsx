/**
 * Histoires par année, en barres. Survoler ou parcourir au clavier (flèches) affiche
 * l'année et son total ; cliquer ouvre la recherche limitée à cette année.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../lib/format";

export function parseYears(raw: string | null | undefined): { year: number; n: number }[] {
  if (!raw) return [];
  const map = new Map<number, number>();
  for (const part of raw.split(",")) {
    const [y, n] = part.split(":").map(Number);
    if (y > 1800 && y < 2200 && n > 0) map.set(y, n);
  }
  if (!map.size) return [];
  const years = [...map.keys()];
  const first = Math.min(...years);
  const last = Math.max(...years);
  const out: { year: number; n: number }[] = [];
  for (let y = first; y <= last; y++) out.push({ year: y, n: map.get(y) ?? 0 });
  return out;
}

const H = 112;

export function YearChart({ years, hrefFor, label }: { years: string | null; hrefFor: (year: number) => string; label: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const data = useMemo(() => parseYears(years), [years]);
  const [active, setActive] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  // Au doigt, un premier appui montre l'année, un second ouvre la recherche.
  const touch = useRef(false);

  const max = Math.max(1, ...data.map((d) => d.n));
  const peak = data.reduce((a, b) => (b.n > a.n ? b : a), data[0] ?? { year: 0, n: 0 });
  if (data.length < 3) return null;

  const step = 10;
  const barW = 7;
  const width = data.length * step;
  const span = data.length;
  const every = span > 70 ? 20 : span > 24 ? 10 : 5;
  const ticks = data.filter((d) => d.year % every === 0);
  const shown = active !== null ? data[active] : null;

  const indexAt = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return null;
    return Math.max(0, Math.min(data.length - 1, Math.floor(((clientX - box.left) / box.width) * data.length)));
  };

  return (
    // Les barres gardent une largeur raisonnable même sur une carrière de quelques années.
    <figure className="year-chart" style={{ maxWidth: Math.max(240, data.length * 26) }}>
      <figcaption className="year-chart__head">
        <span className="year-chart__title">{label}</span>
        <span className="year-chart__readout num" aria-live="polite">
          {shown
            ? t("chart.year", { year: shown.year, count: shown.n, n: formatNumber(shown.n) })
            : t("chart.peak", { year: peak.year, count: peak.n, n: formatNumber(peak.n) })}
        </span>
      </figcaption>
      <svg
        ref={svg}
        className="year-chart__plot"
        viewBox={`0 0 ${width} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t("chart.aria", { label, from: data[0].year, to: data[data.length - 1].year })}
        tabIndex={0}
        onPointerDown={(e) => {
          touch.current = e.pointerType !== "mouse";
        }}
        onPointerMove={(e) => e.pointerType === "mouse" && setActive(indexAt(e.clientX))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onBlur={() => setActive(null)}
        onClick={(e) => {
          const i = indexAt(e.clientX);
          if (i === null) return;
          if (touch.current && active !== i) {
            setActive(i);
            return;
          }
          if (data[i].n) navigate(hrefFor(data[i].year));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const d = e.key === "ArrowRight" ? 1 : -1;
            setActive((a) => Math.max(0, Math.min(data.length - 1, (a ?? (d > 0 ? -1 : data.length)) + d)));
          } else if (e.key === "Enter" && active !== null && data[active].n) {
            navigate(hrefFor(data[active].year));
          }
        }}
      >
        {data.map((d, i) => {
          const h = d.n ? Math.max(2, (d.n / max) * (H - 4)) : 0;
          return (
            <rect
              key={d.year}
              x={i * step + (step - barW) / 2}
              y={H - h}
              width={barW}
              height={h}
              rx={1.5}
              className={i === active ? "is-active" : undefined}
              style={{ animationDelay: `${Math.min(i * 6, 360)}ms` }}
            />
          );
        })}
      </svg>
      <div className="year-chart__axis num" aria-hidden>
        {ticks.map((d) => (
          <span key={d.year} style={{ left: `${((data.indexOf(d) + 0.5) / data.length) * 100}%` }}>
            {d.year}
          </span>
        ))}
      </div>
    </figure>
  );
}
