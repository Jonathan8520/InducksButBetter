import { describe, expect, it } from "vitest";
import { isImageResponse, resolveImageTarget } from "./imageProxy";

/**
 * `resolveImageTarget` est le garde-fou du proxy d'images : c'est lui qui empêche l'endpoint
 * `/api/proxy-image` de devenir un relais ouvert (SSRF, abus de bande passante). La régression
 * à craindre est silencieuse — un proxy trop permissif ne lève rien, il obéit — d'où ce test.
 */
describe("resolveImageTarget", () => {
  it("accepte un hôte Inducks en https", () => {
    const r = resolveImageTarget("https://inducks.org/hr.php?image=x");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.target).toContain("inducks.org");
      expect(r.referer).toBe("https://inducks.org/");
    }
  });

  it("accepte outducks.org (conservé pour un futur CDN)", () => {
    expect(resolveImageTarget("https://outducks.org/webusers/x.jpg").ok).toBe(true);
  });

  it("ignore la casse de l'hôte", () => {
    expect(resolveImageTarget("https://INDUCKS.ORG/x.jpg").ok).toBe(true);
  });

  it("refuse un hôte hors liste blanche", () => {
    const r = resolveImageTarget("https://evil.example.com/x.jpg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("refuse un sous-domaine non listé qui contient un hôte autorisé", () => {
    // `inducks.org.evil.com` ne doit PAS passer : la comparaison est sur l'hôte exact.
    expect(resolveImageTarget("https://inducks.org.evil.com/x.jpg").ok).toBe(false);
  });

  it("refuse les protocoles non http(s)", () => {
    for (const u of ["file:///etc/passwd", "data:text/html,x", "ftp://inducks.org/x"]) {
      const r = resolveImageTarget(u);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it("refuse une entrée vide ou absente", () => {
    for (const u of [null, undefined, ""]) {
      const r = resolveImageTarget(u);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it("refuse une URL malformée", () => {
    const r = resolveImageTarget("pas une url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});

describe("isImageResponse", () => {
  it("n'accepte qu'une réponse OK au content-type image/*", () => {
    expect(isImageResponse(true, "image/jpeg")).toBe(true);
    expect(isImageResponse(true, "image/webp; charset=binary")).toBe(true);
    // La page d'erreur 503 d'inducks.org : OK false OU du HTML — jamais relayée comme image.
    expect(isImageResponse(false, "image/jpeg")).toBe(false);
    expect(isImageResponse(true, "text/html; charset=iso-8859-1")).toBe(false);
    expect(isImageResponse(true, null)).toBe(false);
  });
});
