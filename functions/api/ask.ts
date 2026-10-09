/**
 * functions/api/ask.ts — Assistant SQL côté serveur (Cloudflare Pages Function).
 *
 * POST /api/ask { messages: [{ role, content }] } -> { text }
 *
 * Interroge Workers AI via la liaison `AI` (wrangler.toml) : aucune clé n'est exposée au
 * visiteur. Sur le plan gratuit, l'allocation quotidienne est plafonnée sans facturation ;
 * une fois épuisée, l'appel échoue et le client se rabat sur un autre service.
 */

interface Env {
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const MODELS = ["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"];
const MAX_CHARS = 24_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function textOf(out: unknown): string | null {
  if (!out || typeof out !== "object") return typeof out === "string" ? out : null;
  const o = out as Record<string, unknown>;
  if (typeof o.response === "string") return o.response;
  const choices = o.choices as { message?: { content?: string } }[] | undefined;
  if (Array.isArray(choices) && typeof choices[0]?.message?.content === "string") return choices[0].message.content;
  if (o.result && typeof o.result === "object") return textOf(o.result);
  return null;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  if (!env.AI) return json({ error: "AI binding unavailable" }, 503);

  let messages: Message[];
  try {
    const body = (await request.json()) as { messages?: Message[] };
    messages = (body.messages ?? [])
      .filter((m) => m && typeof m.content === "string" && ["system", "user", "assistant"].includes(m.role))
      .slice(-8);
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const size = messages.reduce((n, m) => n + m.content.length, 0);
  if (!messages.length || size > MAX_CHARS) return json({ error: "invalid request" }, 400);

  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, { messages, max_tokens: 700, temperature: 0.1 });
      let text = textOf(out);
      if (text) {
        // Les modèles « raisonneurs » préfixent leur réponse d'un bloc de réflexion.
        text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        return json({ text, model });
      }
      errors.push(`${model}: empty`);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return json({ error: errors.join(" | ") }, 502);
}

export function onRequestGet(): Response {
  return json({ ok: true, usage: "POST { messages }" });
}
