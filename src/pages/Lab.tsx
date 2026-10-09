import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { Database, Download, Play, Sparkles, Square, Table2, Wand2 } from "lucide-react";
import { Page, PageHead } from "../components/page";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Controls";
import { Sheet } from "../components/ui/Overlay";
import { Skeleton, Spinner } from "../components/ui/States";
import { cancelLab, query, rows, type QueryResult } from "../db/client";
import { ask, extractSql, isReadOnly } from "../lib/ai";
import { SQL_EXAMPLES } from "../lib/schemaDoc";
import { formatBytes, formatNumber } from "../lib/format";
import { settings } from "../lib/store";
import { routes } from "../lib/routes";

const SqlEditor = lazy(() => import("../components/SqlEditor"));
const MAX_ROWS = 1000;

async function loadSchema(): Promise<Record<string, string[]>> {
  const tables = await rows<{ name: string; type: string }>(
    `SELECT name, type FROM sqlite_master
     WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'fts\\_%\\_%' ESCAPE '\\'
     ORDER BY name`,
  );
  const out: Record<string, string[]> = {};
  for (const t of tables) {
    const cols = await rows<{ name: string }>(`SELECT name FROM pragma_table_info(?)`, [t.name]);
    out[t.name] = cols.map((c) => c.name);
  }
  return out;
}

function useDark() {
  const theme = settings.use((s) => s.theme);
  const [sys, setSys] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSys(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return theme === "dark" || (theme === "system" && sys);
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Uint8Array) return `<${v.length} bytes>`;
  return String(v);
}

function linkFor(col: string, v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  if (col === "storycode") return routes.story(v);
  if (col === "issuecode") return routes.issue(v);
  if (col === "publicationcode") return routes.publication(v);
  if (col === "personcode") return routes.creator(v);
  if (col === "charactercode") return routes.character(v);
  return null;
}

export default function Lab() {
  const { t } = useTranslation();
  const dark = useDark();
  const [sql, setSql] = useState(SQL_EXAMPLES[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const schema = useQuery({ queryKey: ["schema"], queryFn: loadSchema, staleTime: Infinity });

  const run = useCallback(
    async (text?: string) => {
      const q = (text ?? sql).trim();
      if (!q) return null;
      setRunning(true);
      setError(null);
      try {
        const r = await query(q, [], { lane: "lab", maxRows: MAX_ROWS, timeoutMs: 120_000 });
        setResult(r);
        return null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg === "cancelled" ? t("lab.cancelled") : msg);
        setResult(null);
        return msg;
      } finally {
        setRunning(false);
      }
    },
    [sql, t],
  );

  const runRef = useRef(run);
  runRef.current = run;
  const onRun = useCallback(() => void runRef.current(), []);

  const generate = async () => {
    const qn = question.trim();
    if (!qn) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setThinking(true);
    setAiNote(null);
    try {
      let answer = await ask([{ role: "user", content: qn }], ctrl.signal);
      let generated = extractSql(answer.text);
      if (!generated || !isReadOnly(generated)) throw new Error(t("lab.aiNoSql"));
      setSql(generated);
      let failure = await run(generated);
      // Une seconde chance : le modèle voit l'erreur de SQLite et corrige sa requête.
      if (failure && !ctrl.signal.aborted) {
        answer = await ask(
          [
            { role: "user", content: qn },
            { role: "assistant", content: "```sql\n" + generated + "\n```" },
            { role: "user", content: `SQLite error: ${failure}\nFix the query. Reply with SQL only.` },
          ],
          ctrl.signal,
        );
        generated = extractSql(answer.text);
        if (generated && isReadOnly(generated)) {
          setSql(generated);
          failure = await run(generated);
        }
      }
      setAiNote(t("lab.aiBy", { provider: answer.provider }));
    } catch (err) {
      if (!ctrl.signal.aborted) setAiNote(t("lab.aiError", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setThinking(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const lines = [result.columns, ...result.rows.map((r) => result.columns.map((c) => cellText(r[c])))];
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = "inducks-query.csv";
    a.click();
  };

  const tables = useMemo(() => Object.entries(schema.data ?? {}), [schema.data]);

  const SchemaList = (
    <ul className="schema">
      {tables.map(([name, cols]) => (
        <li key={name}>
          <button className="schema__table" onClick={() => setSql(`SELECT *\nFROM ${name}\nLIMIT 50`)}>
            <Table2 size={14} />
            {name}
          </button>
          <span className="schema__cols">{cols.join(", ")}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <Page title={t("lab.title")} wide>
      <PageHead
        title={t("lab.title")}
        lead={t("lab.lead")}
        actions={
          <Button icon={<Database size={16} />} onClick={() => setSchemaOpen(true)}>
            {t("lab.schema")}
          </Button>
        }
      />

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <Sparkles size={18} className="ask__icon" aria-hidden />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("lab.askPlaceholder")}
          aria-label={t("lab.askPlaceholder")}
        />
        <Button
          type="submit"
          variant="primary"
          className="ask__go"
          aria-label={thinking ? t("lab.thinking") : t("lab.ask")}
          icon={thinking ? <Spinner size={14} /> : <Wand2 size={16} />}
          disabled={thinking || !question.trim()}
        >
          {thinking ? t("lab.thinking") : t("lab.ask")}
        </Button>
      </form>
      <AnimatePresence>
        {aiNote && (
          <motion.p className="ask__note muted" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {aiNote}{" "}
            <Link className="link" to={routes.settings()}>
              {t("lab.aiSettings")}
            </Link>
          </motion.p>
        )}
      </AnimatePresence>

      <div className="lab">
        <div className="lab__editor">
          <div className="lab__bar">
            <Select
              aria-label={t("lab.examples")}
              value=""
              onChange={(e) => {
                const ex = SQL_EXAMPLES[Number(e.target.value)];
                if (ex) setSql(ex.sql);
              }}
            >
              <option value="">{t("lab.examples")}</option>
              {SQL_EXAMPLES.map((ex, i) => (
                <option key={i} value={i}>
                  {t(`lab.${ex.label}`)}
                </option>
              ))}
            </Select>
            <span className="spacer" />
            {running ? (
              <Button variant="danger" icon={<Square size={14} />} onClick={() => cancelLab()}>
                {t("lab.stop")}
              </Button>
            ) : (
              <Button variant="primary" icon={<Play size={15} />} onClick={() => void run()}>
                {t("lab.run")} <kbd className="kbd-inline">Ctrl ↵</kbd>
              </Button>
            )}
          </div>
          <Suspense fallback={<Skeleton w="100%" h={180} />}>
            <SqlEditor value={sql} onChange={setSql} onRun={onRun} schema={schema.data ?? {}} dark={dark} />
          </Suspense>
        </div>

        <div className="lab__result">
          {running && (
            <p className="muted lab__status">
              <Spinner size={14} /> {t("lab.running")}
            </p>
          )}
          {error && (
            <pre className="lab__error" role="alert">
              {error}
            </pre>
          )}
          {result && !running && (
            <>
              <div className="lab__stats">
                <span className="num">{t("lab.rows", { count: result.rows.length, n: formatNumber(result.rows.length) })}{result.truncated ? "+" : ""}</span>
                <span className="num">{Math.round(result.ms)} ms</span>
                <span className="num">{t("lab.io", { req: formatNumber(result.io.requests), size: formatBytes(result.io.bytes) })}</span>
                <span className="spacer" />
                {result.rows.length > 0 && (
                  <Button size="sm" icon={<Download size={14} />} onClick={exportCsv}>
                    CSV
                  </Button>
                )}
              </div>
              <div className="table-wrap lab__table">
                <table className="table table--dense">
                  <thead>
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => (
                      <tr key={i}>
                        {result.columns.map((c) => {
                          const href = linkFor(c, r[c]);
                          const text = cellText(r[c]);
                          return (
                            <td key={c} className={typeof r[c] === "number" ? "num" : undefined}>
                              {href ? (
                                <Link className="link" to={href}>
                                  {text}
                                </Link>
                              ) : text.length > 160 ? (
                                <span title={text}>{text.slice(0, 160)}…</span>
                              ) : (
                                text
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!result && !error && !running && <p className="muted">{t("lab.hint")}</p>}
        </div>
      </div>

      <Sheet open={schemaOpen} onClose={() => setSchemaOpen(false)} title={t("lab.schema")}>
        {schema.data ? SchemaList : <Skeleton w="100%" h={300} />}
      </Sheet>
    </Page>
  );
}
