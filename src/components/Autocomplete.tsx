import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Spinner } from "./ui/States";

export interface Suggestion {
  value: string;
  label: string;
  sub?: ReactNode;
}

/** Champ à suggestions : la liste se charge pendant la frappe, Entrée choisit. */
export function Autocomplete({
  placeholder,
  load,
  onPick,
  queryKey,
  label,
  minChars = 2,
}: {
  placeholder: string;
  load: (q: string) => Promise<Suggestion[]>;
  onPick: (s: Suggestion) => void;
  queryKey: string;
  label: string;
  minChars?: number;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 160);
    return () => clearTimeout(h);
  }, [q]);

  const res = useQuery({
    queryKey: ["ac", queryKey, debounced],
    queryFn: () => load(debounced),
    enabled: debounced.length >= minChars,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
  const list = debounced.length >= minChars ? (res.data ?? []) : [];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (s: Suggestion | undefined) => {
    if (!s) return;
    onPick(s);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="ac" ref={box}>
      <div className="ac__field">
        <input
          className="input"
          value={q}
          placeholder={placeholder}
          aria-label={label}
          role="combobox"
          aria-expanded={open && list.length > 0}
          aria-controls={id}
          aria-autocomplete="list"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(list.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(list[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {res.isFetching && <Spinner size={14} />}
      </div>
      <AnimatePresence>
        {open && list.length > 0 && (
          <motion.ul
            id={id}
            role="listbox"
            className="ac__list"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            {list.map((s, i) => (
              <li
                key={s.value}
                role="option"
                aria-selected={i === active}
                className={i === active ? "is-active" : undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
              >
                <Plus size={14} aria-hidden />
                <span>
                  <span>{s.label}</span>
                  {s.sub && <small>{s.sub}</small>}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
