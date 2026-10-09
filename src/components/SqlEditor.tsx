import CodeMirror from "@uiw/react-codemirror";
import { sql, SQLite } from "@codemirror/lang-sql";
import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useMemo } from "react";

/**
 * Thème de l'éditeur tiré des jetons du site : mêmes fonds, même encre, même jaune pour
 * la sélection. Les couleurs passent par des variables CSS, donc un seul thème suit le
 * mode clair ou sombre sans recréer l'éditeur.
 */
const siteTheme = [
  EditorView.theme({
    "&": { backgroundColor: "transparent", color: "var(--ink)", fontSize: "14px" },
    ".cm-content": { fontFamily: "var(--font-mono)", caretColor: "var(--ink)", padding: "10px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ink)", borderLeftWidth: "2px" },
    ".cm-gutters": { backgroundColor: "transparent", color: "var(--ink-3)", border: "none" },
    ".cm-activeLine": { backgroundColor: "var(--code-active)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--code-selection) !important",
    },
    ".cm-matchingBracket": { backgroundColor: "var(--code-selection)", outline: "none" },
    ".cm-tooltip": {
      backgroundColor: "var(--raised)",
      color: "var(--ink)",
      border: "1px solid var(--line)",
      borderRadius: "8px",
      boxShadow: "var(--shadow-md)",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--marker)", color: "var(--marker-ink)" },
    ".cm-completionDetail": { color: "var(--ink-3)", fontStyle: "normal" },
  }),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: "var(--code-kw)", fontWeight: "600" },
      { tag: [tags.string, tags.special(tags.string)], color: "var(--code-str)" },
      { tag: [tags.number, tags.bool, tags.null], color: "var(--code-num)" },
      { tag: [tags.function(tags.variableName), tags.standard(tags.name), tags.typeName], color: "var(--code-fn)" },
      { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--ink-3)", fontStyle: "italic" },
      { tag: [tags.operator, tags.punctuation, tags.paren, tags.separator], color: "var(--ink-2)" },
    ]),
  ),
];

/** Éditeur SQL, chargé à la demande : CodeMirror ne pèse que sur la page du labo. */
export default function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  schema: Record<string, string[]>;
  dark?: boolean;
}) {
  const extensions = useMemo(
    () => [
      sql({ dialect: SQLite, schema, upperCaseKeywords: true }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": "SQL" }),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRun();
              return true;
            },
          },
        ]),
      ),
    ],
    [schema, onRun],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={siteTheme}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, syntaxHighlighting: false }}
      minHeight="160px"
      maxHeight="420px"
      aria-label="SQL"
    />
  );
}
