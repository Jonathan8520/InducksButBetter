import { describe, expect, it } from "vitest";
import { ftsTrigram, ftsWords, highlight, norm, packCode } from "../text";
import { decodeSegment, routes, splitIssue } from "../routes";
import { parseCollection } from "../collection";
import { extractSql, isReadOnly } from "../ai";

describe("text", () => {
  it("normalise casse et accents comme le script de construction", () => {
    expect(norm("Super Picsou Géant")).toBe("super picsou geant");
    expect(norm("Größe")).toBe("grosse");
  });
  it("compacte les codes d'histoire", () => {
    expect(packCode("W OS  386-02")).toBe("wos386-02");
  });
  it("produit des requêtes FTS sans opérateur injectable", () => {
    expect(ftsWords('Only a "poor" OR man*')).toBe('"only" "a" "poor" "or" "man"*');
    expect(ftsWords("  ")).toBeNull();
    expect(ftsTrigram("ro")).toBeNull();
    expect(ftsTrigram('Don "Rosa"')).toBe('"don  rosa"'.replace("  ", " "));
  });
  it("surligne sans tenir compte des accents", () => {
    const parts = highlight("Le Trésor de Picsou", "tresor");
    expect(parts.find((p) => p.hit)?.text).toBe("Trésor");
  });
});

describe("routes", () => {
  it("garde les espaces significatifs des codes", () => {
    const url = routes.story("W OS  386-02");
    expect(url).toBe("/stories/W+OS++386-02");
    expect(decodeSegment(url.split("/")[2])).toBe("W OS  386-02");
  });
  it("découpe un code de numéro", () => {
    expect(splitIssue("fr/PM  272", "fr/PM")).toEqual({ pub: "fr/PM", number: "272" });
    expect(routes.issue("fr/PM  272", "fr/PM")).toBe("/issues/fr/PM/272");
    expect(routes.publication("it/TL")).toBe("/publications/it/TL");
  });
});

describe("collection", () => {
  it("lit l'export Inducks en conservant le remplissage intérieur", () => {
    const text = "country^entrycode^type^comment\nfr^PM  272^^\nbe^MMN   8^digital^\nfr^PM  272^digital^\nfr/JM 3000\n";
    expect(parseCollection(text)).toEqual(["fr/PM  272", "be/MMN   8", "fr/JM 3000"]);
  });
});

describe("assistant", () => {
  it("extrait une requête d'une réponse en Markdown", () => {
    expect(extractSql("Voici :\n```sql\nSELECT 1;\n```")).toBe("SELECT 1");
    expect(extractSql("pas de requête")).toBeNull();
  });
  it("refuse toute écriture", () => {
    expect(isReadOnly("SELECT * FROM story")).toBe(true);
    expect(isReadOnly("WITH a AS (SELECT 1) SELECT * FROM a")).toBe(true);
    expect(isReadOnly("DROP TABLE story")).toBe(false);
    expect(isReadOnly("SELECT 1; DELETE FROM story")).toBe(false);
    expect(isReadOnly("SELECT 'drop table' AS x")).toBe(true);
  });
});

describe("graphique par année", () => {
  it("comble les années vides et ignore les valeurs absurdes", async () => {
    const { parseYears } = await import("../years");
    expect(parseYears("1950:2,1952:5,0:9,1951:x")).toEqual([
      { year: 1950, n: 2 },
      { year: 1951, n: 0 },
      { year: 1952, n: 5 },
    ]);
    expect(parseYears(null)).toEqual([]);
  });
});

describe("liste de manques", () => {
  it("regroupe les numéros qui se suivent", async () => {
    const { compactNumbers } = await import("../collection");
    expect(compactNumbers(["1", "2", "3", "5", "7", "8", "HS 1", "9"])).toBe("1-3, 5, 7-8, HS 1, 9");
    expect(compactNumbers([])).toBe("");
  });
});
