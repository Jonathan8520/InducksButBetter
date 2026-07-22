import { describe, expect, it } from "vitest";
import { getStorycodeCandidates } from "./searchService";

/**
 * `getStorycodeCandidates` réimplémente les heuristiques de `coa/util14-storycode.php`
 * d'Inducks : une vingtaine de règles qui traduisent ce que tape un collectionneur
 * (« US 1 », « HJR 1984 », « TL 123 ») vers le vrai storycode COA. C'est une fonction pure,
 * sans base de données, donc entièrement testable — et c'est aussi le seul endroit du
 * projet où une régression serait silencieuse : une règle cassée ne lève rien, elle rend
 * simplement des résultats vides.
 */

/** Vrai si l'une des formes proposées correspond, compactée ou non. */
function proposes(input: string, expected: string): boolean {
  const packedExpected = expected.replace(/\s+/g, "").toLowerCase();
  return getStorycodeCandidates(input).some(
    (c) => c.unpacked.toUpperCase() === expected.toUpperCase() || c.packed === packedExpected,
  );
}

describe("getStorycodeCandidates", () => {
  it("conserve toujours la saisie brute parmi les candidats", () => {
    const candidates = getStorycodeCandidates("W OS  178-02");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].unpacked).toBe("W OS 178-02");
  });

  it("compacte en minuscules sans espaces ni ponctuation parasite", () => {
    const [first] = getStorycodeCandidates("W OS 178-02");
    // Le tiret est conservé : il fait partie des codes (numéro de partie).
    expect(first.packed).toBe("wos178-02");
  });

  it("ne produit jamais deux fois la même forme compactée", () => {
    const packed = getStorycodeCandidates("W OS 386").map((c) => c.packed);
    expect(new Set(packed).size).toBe(packed.length);
  });

  describe("préfixes de publication", () => {
    it("complète « OS 1 » en « W OS 1 »", () => {
      expect(proposes("OS 1", "W OS 1")).toBe(true);
    });

    it("traduit « WDCS » en « W WDC »", () => {
      expect(proposes("WDCS 100", "W WDC 100")).toBe(true);
    });

    it("traduit « W FC » en « W OS »", () => {
      expect(proposes("W FC 178", "W OS 178")).toBe(true);
    });
  });

  describe("Dell Giants — les trois numéros W US ont un équivalent W OS", () => {
    it.each([
      ["US 1", "W OS 386"],
      ["US 2", "W OS 456"],
      ["US 3", "W OS 495"],
    ])("%s -> %s", (input, expected) => {
      expect(proposes(input, expected)).toBe(true);
    });
  });

  describe("Topolino italien", () => {
    it("complète « I 123 » en « I TL 123 »", () => {
      expect(proposes("I 123", "I TL 123")).toBe(true);
    });

    it("complète « I T 123 » en « I TL 123 »", () => {
      expect(proposes("I T 123", "I TL 123")).toBe(true);
    });
  });

  describe("hebdomadaires néerlandais", () => {
    it("insère le zéro de la semaine : « H 8412 » -> « H 84012 »", () => {
      expect(proposes("H 8412", "H 84012")).toBe(true);
    });

    it("convertit HJR sur 4 chiffres", () => {
      expect(proposes("HJR 1984", "H 19084")).toBe(true);
    });

    it("convertit HLN sur 4 chiffres", () => {
      expect(proposes("HLN 1984", "H 19084")).toBe(true);
    });

    it("laisse passer HJR sur 5 chiffres sans réinsérer de zéro", () => {
      expect(proposes("HJR 19084", "H 19084")).toBe(true);
    });
  });

  it("sépare le préfixe pays du numéro : « D2000 » -> « D 2000 »", () => {
    expect(proposes("D2000", "D 2000")).toBe(true);
  });

  it("remplace un tiret de préfixe par une espace : « W-OS 178 » -> « W OS 178 »", () => {
    expect(proposes("W-OS 178", "W OS 178")).toBe(true);
  });

  it("normalise les espaces multiples", () => {
    const [first] = getStorycodeCandidates("  W   OS   178  ");
    expect(first.unpacked).toBe("W OS 178");
  });

  it("ne lève pas sur une saisie vide ou d'un seul caractère", () => {
    expect(() => getStorycodeCandidates("")).not.toThrow();
    expect(() => getStorycodeCandidates("W")).not.toThrow();
  });
});
