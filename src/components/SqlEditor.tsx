import { useState, useMemo, useEffect } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { sql, SQLite } from "@codemirror/lang-sql"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { Play, Database as DbIcon, Loader2, AlertCircle, RotateCcw, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { SectionTitle } from "@/components/SectionTitle"
import { SortableTh } from "@/components/SortableTh"
import { EmptyState } from "@/components/EmptyState"
import { useTheme } from "@/hooks/useTheme"
import { tursoClient } from "@/lib/turso"
import { DEFAULT_DB_SCHEMA } from "@/lib/defaultSchema"
import { toast } from "sonner"

interface SqlEditorProps {
  query: string
  setQuery: (query: string) => void
}

/** Returns a CodeMirror SQL extension pre-loaded with DB schema for autocompletion */
function useSqlExtension(schema: Record<string, string[]>) {
  return useMemo(() => {
    const dialect = SQLite
    if (Object.keys(schema).length === 0) {
      return sql({ dialect })
    }
    const tables: Record<string, string[]> = schema
    return sql({
      dialect,
      schema: tables,
      defaultSchema: "main",
    })
  }, [schema])
}

export function SqlEditor({ query, setQuery }: SqlEditorProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
    key: "",
    direction: null,
  })
  const [rotating, setRotating] = useState(false)
  const [dbSchema, setDbSchema] = useState<Record<string, string[]>>(DEFAULT_DB_SCHEMA)

  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())

  // Reset columns when results change
  useEffect(() => {
    if (results.length > 0) {
      setColumnOrder(Object.keys(results[0]))
      setHiddenColumns(new Set())
    } else {
      setColumnOrder([])
      setHiddenColumns(new Set())
    }
  }, [results])

  const visibleColumns = useMemo(() => {
    return columnOrder.filter((col) => !hiddenColumns.has(col))
  }, [columnOrder, hiddenColumns])

  const handleHideColumn = (col: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      next.add(col)
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, col: string) => {
    e.dataTransfer.setData("text/plain", col)
  }

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault() // Required to allow dropping
  }

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetCol: string) => {
    e.preventDefault()
    const sourceCol = e.dataTransfer.getData("text/plain")
    if (sourceCol === targetCol) return

    setColumnOrder((prev) => {
      const newOrder = [...prev]
      const sourceIdx = newOrder.indexOf(sourceCol)
      const targetIdx = newOrder.indexOf(targetCol)
      if (sourceIdx !== -1 && targetIdx !== -1) {
        newOrder.splice(sourceIdx, 1)
        newOrder.splice(targetIdx, 0, sourceCol)
      }
      return newOrder
    })
  }

  // Use default schema for autocompletion (standalone mode)
  useEffect(() => {
    setDbSchema(DEFAULT_DB_SCHEMA)
  }, [])

  const sqlExtension = useSqlExtension(dbSchema)

  // Light theme customization for the editor
  const lightTheme = EditorView.theme({
    "&": {
      backgroundColor: "hsl(var(--surface))",
      color: "hsl(var(--text-body))",
      fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      fontSize: "13px",
    },
    ".cm-gutters": {
      backgroundColor: "hsl(var(--surface-2))",
      borderRight: "1px solid hsl(var(--border-subtle))",
      color: "hsl(var(--text-hint))",
    },
    ".cm-activeLineGutter": { backgroundColor: "hsl(var(--surface-3))" },
    ".cm-activeLine": { backgroundColor: "hsl(var(--surface-2))" },
    ".cm-cursor": { borderLeftColor: "hsl(var(--primary))" },
    ".cm-selectionBackground": { backgroundColor: "hsl(var(--primary) / 0.15) !important" },
    ".cm-tooltip": {
      backgroundColor: "hsl(var(--surface))",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 4px 16px rgba(0,0,0,.12)",
      borderRadius: "8px",
    },
    ".cm-tooltip-autocomplete > ul": {
      maxHeight: "220px",
      fontFamily: "'Fira Code', monospace",
      fontSize: "12px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "hsl(var(--primary))",
      color: "#fff",
    },
    ".cm-completionLabel": { color: "hsl(var(--text-body))" },
    ".cm-completionDetail": { color: "hsl(var(--text-hint))", fontStyle: "italic" },
  })

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("inducks_sql_history")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const handleRunQuery = async () => {
    setLoading(true)
    setError(null)
    setSortConfig({ key: "", direction: null })

    if (query.trim()) {
      setHistory((prev) => {
        const filtered = prev.filter((q) => q.trim() !== query.trim())
        const nextHistory = [...filtered, query]
        if (nextHistory.length > 50) nextHistory.shift()
        localStorage.setItem("inducks_sql_history", JSON.stringify(nextHistory))
        setHistoryIndex(nextHistory.length - 1)
        return nextHistory
      })
    }

    try {
      // Direct Turso connection for standalone mode
      if (!query.trim().toLowerCase().startsWith("select")) {
        throw new Error("Only SELECT queries are allowed.")
      }
      const result = await tursoClient.execute({ sql: query, args: [] })
      setResults(result.rows || [])
      
      const count = result.rows?.length || 0
      toast.success(
        t("sql.results_count", { count, defaultValue: `${count} result(s) found` }), 
        { description: t("sql.query_success", { defaultValue: "Query executed successfully." }) }
      )
    } catch (err: any) {
      setError(err?.message || "Unable to execute SQL query")
    } finally {
      setLoading(false)
    }
  }

  const handleGoBack = () => {
    if (history.length === 0) return
    setRotating(true)
    setTimeout(() => setRotating(false), 400)

    let nextIndex = historyIndex
    if (nextIndex === -1) nextIndex = history.length - 1
    else nextIndex = nextIndex - 1
    if (nextIndex < 0) nextIndex = history.length - 1

    setHistoryIndex(nextIndex)
    setQuery(history[nextIndex])
  }

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc"
    else if (sortConfig.key === key && sortConfig.direction === "desc") direction = null
    setSortConfig({ key, direction })
  }

  const sortedResults = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return results
    return [...results].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum
      }
      const sA = String(aVal).toLowerCase()
      const sB = String(bVal).toLowerCase()
      if (sA < sB) return sortConfig.direction === "asc" ? -1 : 1
      if (sA > sB) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })
  }, [results, sortConfig])

  const editorExtensions = useMemo(
    () => [sqlExtension, EditorView.lineWrapping],
    [sqlExtension]
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <SectionTitle icon={DbIcon}>{t("sql.title")}</SectionTitle>
                <a
                  href="https://inducks.org/bolderbast/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-hint hover:text-text-secondary transition-colors"
                  title="Inducks Database Documentation"
                >
                  <Info className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleGoBack}
                  disabled={history.length === 0}
                  title={t("sql.previous_query")}
                  type="button"
                >
                  <RotateCcw
                    className={cn("w-4 h-4 transition-transform duration-300", rotating && "-rotate-45")}
                  />
                </Button>
                <Button onClick={handleRunQuery} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {t("sql.run_query")}
                </Button>
              </div>
            </div>

            {/* Schema hint */}
            {Object.keys(dbSchema).length > 0 && (
              <div className="flex overflow-x-auto gap-2 text-[10px] items-center pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <span className="text-text-hint font-medium whitespace-nowrap shrink-0">{t("sql.tables") || "Tables :"}</span>
                {Object.keys(dbSchema).map((tbl) => (
                  <span
                    key={tbl}
                    className="px-2 py-0.5 bg-surface-2 border border-border-subtle rounded font-mono text-primary cursor-pointer hover:bg-surface-3 transition-colors whitespace-nowrap shrink-0"
                    onClick={() => setQuery(`SELECT * FROM ${tbl} LIMIT 20`)}
                    title={`Colonnes : ${dbSchema[tbl].join(", ")}`}
                  >
                    {tbl}
                  </span>
                ))}
              </div>
            )}

            {/* CodeMirror editor */}
            <div className="rounded-xl overflow-hidden border border-border ring-0 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <CodeMirror
                value={query}
                height="220px"
                extensions={editorExtensions}
                theme={isDark ? oneDark : lightTheme}
                onChange={(val) => setQuery(val)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault()
                    handleRunQuery()
                  }
                }}
                placeholder={t("sql.placeholder")}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                  foldGutter: false,
                  autocompletion: true,
                  bracketMatching: true,
                  closeBrackets: true,
                }}
              />
            </div>


          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md flex gap-3 text-destructive items-center">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <Card className="rounded-2xl border border-border shadow-xl overflow-hidden bg-surface">
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 z-10 text-xs text-text-hint uppercase border-b border-border font-bold tracking-wider">
                <tr>
                  {visibleColumns.map((col) => (
                    <SortableTh
                      key={col}
                      col={col}
                      sortKey={sortConfig.key}
                      direction={sortConfig.direction}
                      onSort={handleSort}
                      onHide={handleHideColumn}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedResults.map((row, i) => (
                  <tr key={i} className="bg-surface hover:bg-surface-2 transition-colors">
                    {visibleColumns.map((col) => (
                      <td key={col} className="px-6 py-4 font-medium text-text-body whitespace-nowrap border-x border-border-subtle/50">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {results.length === 0 && !loading && !error && (
        <EmptyState
          icon={DbIcon}
          title={t("sql.no_results", { defaultValue: "No results" })}
          description={t("sql.no_results_desc", { defaultValue: "Run a query to see data." })}
        />
      )}
    </div>
  )
}
