import { describe, expect, it } from "vitest";
import fr from "./fr";
import en from "./en";
import de from "./de";
import it_ from "./it";
import es from "./es";
import pt from "./pt";
import nl from "./nl";

const flat = (o: object, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));

describe("traductions", () => {
  const ref = new Set(flat(en));
  for (const [name, bundle] of Object.entries({ fr, de, it: it_, es, pt, nl })) {
    it(`${name} a exactement les clés de l'anglais`, () => {
      const keys = new Set(flat(bundle));
      expect([...ref].filter((k) => !keys.has(k))).toEqual([]);
      expect([...keys].filter((k) => !ref.has(k))).toEqual([]);
    });
  }
});
