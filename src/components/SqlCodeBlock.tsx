import { useState } from "react"
import { Copy, Check, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import CodeMirror from "@uiw/react-codemirror"
import { sql } from "@codemirror/lang-sql"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"

interface SqlCodeBlockProps {
  code: string
  bubbleId: number
  onCopyToEditor?: (query: string) => void
}

/** SQL code block with syntax display, copy and "use in editor" actions */
export function SqlCodeBlock({ code, bubbleId, onCopyToEditor }: SqlCodeBlockProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2 flex flex-col gap-1">
      <div className="bg-surface-invert text-text-hint p-3 rounded-lg font-mono text-[11px] relative overflow-x-auto group">
        <div className="rounded-lg overflow-hidden border border-border">
          <CodeMirror
            value={code}
            extensions={[sql(), EditorView.editable.of(false), EditorView.lineWrapping]}
            theme={oneDark}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            className="text-[12px] bg-surface-invert"
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 h-7 w-7 text-text-secondary hover:text-white transition-opacity opacity-0 group-hover:opacity-100"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </Button>
        {onCopyToEditor && (
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-2 right-2 h-7 px-2 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-3 text-foreground hover:bg-surface-3"
            onClick={() => onCopyToEditor(code)}
          >
            <Database className="w-3 h-3" />
            {t("ai.use")}
          </Button>
        )}
      </div>
    </div>
  )
}
