import CodeMirror from "@uiw/react-codemirror";
import { sql, SQLite } from "@codemirror/lang-sql";
import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { useMemo } from "react";

/** Éditeur SQL, chargé à la demande : CodeMirror ne pèse que sur la page du labo. */
export default function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
  dark,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  schema: Record<string, string[]>;
  dark: boolean;
}) {
  const extensions = useMemo(
    () => [
      sql({ dialect: SQLite, schema, upperCaseKeywords: true }),
      EditorView.lineWrapping,
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
      theme={dark ? "dark" : "light"}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      minHeight="160px"
      maxHeight="420px"
      aria-label="SQL"
    />
  );
}
