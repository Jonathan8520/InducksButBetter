/**
 * Assistant SQL en ligne : une question en langage courant devient une requête sur la base.
 *
 * Aucun modèle n'est téléchargé dans le navigateur. Par défaut, la question part vers
 * /api/ask (fonction Cloudflare adossée à Workers AI, sans clé côté visiteur), puis vers un
 * service public sans clé si celui-ci ne répond pas. Un visiteur peut aussi brancher sa
 * propre clé (Groq, OpenRouter, Mistral, Gemini) : elle reste dans son navigateur et n'est
 * envoyée qu'au fournisseur choisi.
 */
import { SCHEMA_DOC } from "./schemaDoc";
import { settings, type AiProvider } from "./store";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM = `You translate questions about Disney comics into ONE SQLite query for the I.N.D.U.C.K.S. database described below.

Rules:
- Reply with the SQL only, inside one \`\`\`sql block. No explanation.
- Read-only: a single SELECT (WITH allowed). Always end with LIMIT (<= 200) unless the query aggregates to few rows.
- Story codes, issue codes and person/character codes are codes, not names. Find a creator by name with: SELECT key FROM fts_person WHERE fts_person MATCH '"don rosa"' (lower-case, no accents), or person.name LIKE. Find characters the same way with fts_character, which covers names in every language (Picsou, Dagobert, Paperone all mean code 'US').
- Well-known codes: CB = Carl Barks, DR = Don Rosa, RSc = Romano Scarpa, GCa = Giorgio Cavazzano, FG = Floyd Gottfredson, AT = Al Taliaferro, PM = Paul Murry, WVH = William Van Horn, MRt = Marco Rota, TFa = Tito Faraci. Characters: DD Donald Duck, US Uncle Scrooge, MM Mickey Mouse, GY Gyro Gearloose, HDL Huey Dewey and Louie, GL Gladstone Gander, BB Beagle Boys, MDS Magica De Spell, GO Goofy, PE Pete, PB Phantom Blot, DA Daisy Duck, MI Minnie Mouse, JW Junior Woodchucks.
- Countries are lower-case ISO codes (fr, it, us, de, nl, dk, no, se, fi, br, es…).
- Prefer the clustered tables: person_story for stories of a creator, character_story for stories of a character, story_country for countries, story_pub for printings, toc for issue contents.
- Return readable columns (storycode, title, date, names), not only ids. Join story on sid to get storycode and title.
- story.date and issue.date are text 'YYYY-MM-DD' with variable precision: compare with prefixes, e.g. date >= '1950' AND date < '1960'.
- For "titles containing a word", use fts_story with story_rank (see schema).

Schema:
${SCHEMA_DOC}`;

export function extractSql(text: string): string | null {
  const block = text.match(/```(?:sql|sqlite)?\s*([\s\S]*?)```/i);
  let sql = (block ? block[1] : text).trim();
  const start = sql.search(/\b(WITH|SELECT)\b/i);
  if (start === -1) return null;
  sql = sql.slice(start).trim().replace(/;+\s*$/, "");
  // Une seule instruction : on s'arrête au premier point-virgule hors chaîne.
  const semi = sql.indexOf(";");
  if (semi !== -1) sql = sql.slice(0, semi);
  return sql;
}

export function isReadOnly(sql: string): boolean {
  const s = sql.replace(/'(?:[^']|'')*'/g, "''").toUpperCase();
  if (!/^\s*(WITH|SELECT)\b/.test(s)) return false;
  return !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|REPLACE)\b/.test(s);
}

interface ProviderDef {
  url: string;
  model: string;
  headers: (key: string) => Record<string, string>;
}

const PROVIDERS: Record<Exclude<AiProvider, "auto" | "off">, ProviderDef> = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    headers: (k) => ({ Authorization: `Bearer ${k}`, "X-Title": "InducksButBetter" }),
  },
  mistral: {
    url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
};

async function openAiCall(url: string, headers: Record<string, string>, model: string, messages: ChatMessage[], signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 700 }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${body.slice(0, 160)}`);
  }
  const json = await res.json();
  const text: string | undefined = json?.choices?.[0]?.message?.content ?? json?.response ?? json?.result?.response;
  if (!text) throw new Error("empty answer");
  return text;
}

/** Fonction Cloudflare du site (Workers AI). */
async function viaSite(messages: ChatMessage[], signal?: AbortSignal) {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const res = await fetch(`${base}api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok) throw new Error(`site ${res.status}`);
  const json = await res.json();
  if (!json?.text) throw new Error(json?.error ?? "empty answer");
  return json.text as string;
}

/** Service public sans clé, en dernier recours. */
async function viaPollinations(messages: ChatMessage[], signal?: AbortSignal) {
  return openAiCall("https://text.pollinations.ai/openai", {}, "openai", messages, signal);
}

export interface AskResult {
  text: string;
  provider: string;
}

export async function ask(messages: ChatMessage[], signal?: AbortSignal): Promise<AskResult> {
  const { aiProvider, aiKey, aiModel } = settings.get();
  const full: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...messages];
  if (aiProvider !== "auto" && aiProvider !== "off" && aiKey) {
    const p = PROVIDERS[aiProvider];
    return { text: await openAiCall(p.url, p.headers(aiKey), aiModel || p.model, full, signal), provider: aiProvider };
  }
  const errors: string[] = [];
  for (const [name, fn] of [
    ["workers-ai", viaSite],
    ["pollinations", viaPollinations],
  ] as const) {
    try {
      return { text: await fn(full, signal), provider: name };
    } catch (err) {
      if (signal?.aborted) throw err;
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[];
export const defaultModel = (p: AiProvider) => (p in PROVIDERS ? PROVIDERS[p as keyof typeof PROVIDERS].model : "");
