import { useSyncExternalStore } from "react";

/** État d'interface non persistant : palette de recherche, menu mobile, notifications. */
interface UiState {
  palette: boolean;
  paletteQuery: string;
  explore: boolean;
  toasts: { id: number; text: string; tone?: "ok" | "error" }[];
}

let state: UiState = { palette: false, paletteQuery: "", explore: false, toasts: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const ui = {
  get: () => state,
  set(patch: Partial<UiState>) {
    state = { ...state, ...patch };
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  openPalette(query = "") {
    ui.set({ palette: true, paletteQuery: query, explore: false });
  },
  toast(text: string, tone?: "ok" | "error") {
    const id = Date.now() + Math.random();
    ui.set({ toasts: [...state.toasts, { id, text, tone }] });
    setTimeout(() => ui.set({ toasts: state.toasts.filter((t) => t.id !== id) }), 3200);
  },
};

export function useUi<S>(selector: (s: UiState) => S): S {
  return useSyncExternalStore(ui.subscribe, () => selector(state), () => selector(state));
}

/** Historique local des fiches consultées (affiché dans la palette vide). */
export interface Visit {
  kind: "story" | "issue" | "creator" | "character" | "publication" | "series" | "universe" | "country";
  code: string;
  label: string;
  sub?: string;
  href: string;
}

const KEY = "ibb.visits";
export function recordVisit(v: Visit) {
  try {
    const list: Visit[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const next = [v, ...list.filter((x) => x.href !== v.href)].slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible */
  }
}
export function recentVisits(): Visit[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
