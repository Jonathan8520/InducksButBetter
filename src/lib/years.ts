/** Histogramme « 1947:3,1948:12 » de la base, années manquantes comblées par des zéros. */
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
