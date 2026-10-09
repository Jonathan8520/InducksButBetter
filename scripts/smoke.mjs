#!/usr/bin/env node
/**
 * smoke.mjs — Ouvre le site compilé (avec sa base) dans un vrai navigateur et vérifie que
 * les écrans principaux s'affichent, sans erreur JavaScript. Lancé en CI avant toute mise
 * en ligne : un site qui casse ici n'est jamais publié.
 *
 * Usage : node scripts/smoke.mjs [url]   (par défaut http://127.0.0.1:4173)
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://127.0.0.1:4173").replace(/\/$/, "");

/** [adresse, sélecteur attendu, contrôle supplémentaire sur la page] */
const PAGES = [
  ["/", ".hero__title"],
  ["/stories/W+OS++386-02", ".detail__title", async (p) => (await p.textContent(".detail__title"))?.includes("Poor Old Man")],
  ["/issues/fr/PM/272", ".toc", async (p) => (await p.locator(".toc__row").count()) >= 4],
  ["/search?q=klondike", ".story-row", async (p) => (await p.locator(".story-row").count()) >= 5],
  ["/creators/CB", ".year-chart"],
  ["/characters/US", ".year-chart"],
  ["/publications/fr/PM", ".year-group"],
  ["/countries", ".country-list li"],
  ["/collection", "textarea"],
  ["/lab", ".cm-content"],
  ["/story.php?c=W+OS++386-02", ".detail__title"],
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({ locale: "en-US" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`console: ${m.text()}`);
});
// Les images viennent d'inducks.org : inutile de les attendre en CI.
await context.route(/inducks\.org|outducks\.org/, (route) => route.abort());

let failed = 0;
for (const [path, selector, extra] of PAGES) {
  const started = Date.now();
  try {
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(selector, { timeout: 30_000 });
    if (extra && !(await extra(page))) throw new Error("contenu inattendu");
    console.log(`  ok  ${path} (${Date.now() - started} ms)`);
  } catch (err) {
    failed++;
    console.log(`  ÉCHEC  ${path}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
  }
}
await browser.close();

if (errors.length) {
  console.log(`\n${errors.length} erreur(s) JavaScript :`);
  for (const e of errors.slice(0, 10)) console.log("  " + e);
}
if (failed || errors.length) process.exit(1);
console.log("\n[smoke] tout est bon");
