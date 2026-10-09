/**
 * Petits états persistants (réglages, collection), partagés via useSyncExternalStore.
 * localStorage peut être indisponible (navigation privée, stockage bloqué) : chaque accès
 * est protégé, et l'application fonctionne simplement sans persistance.
 */
import { useSyncExternalStore } from "react";

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible ou plein */
  }
}

export function createStore<T extends object>(key: string, initial: T) {
  let state: T = { ...initial, ...readJson<Partial<T>>(key, {}) };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      writeJson(key, state);
      listeners.forEach((l) => l());
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    use<S>(selector: (s: T) => S): S {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useSyncExternalStore(this.subscribe, () => selector(state), () => selector(state));
    },
  };
}

export type Theme = "system" | "light" | "dark";
export type AiProvider = "auto" | "groq" | "openrouter" | "mistral" | "gemini" | "off";

export interface Settings {
  theme: Theme;
  /** Pays mis en avant (parutions récentes) ; vide = déduit de la langue. */
  country: string;
  aiProvider: AiProvider;
  aiKey: string;
  aiModel: string;
  showNetwork: boolean;
}

export const settings = createStore<Settings>("ibb.settings", {
  theme: "system",
  country: "",
  aiProvider: "auto",
  aiKey: "",
  aiModel: "",
  showNetwork: false,
});

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0f172e" : "#ffffff");
}
