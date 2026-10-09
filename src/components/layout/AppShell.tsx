import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Compass, Moon, Search, Sun, SunMoon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "./Logo";
import { FOOTER, PRIMARY, SECONDARY, isActive, type NavItem } from "./nav";
import { CommandPalette } from "./CommandPalette";
import { Dialog, Sheet } from "../ui/Overlay";
import { IconButton } from "../ui/Button";
import { ui, useUi } from "../../lib/ui";
import { applyTheme, settings, type Theme } from "../../lib/store";
import { onIo, sessionIo } from "../../db/client";
import { formatBytes, formatDate } from "../../lib/format";
import { dbInfo } from "../../data/home";
import { routes } from "../../lib/routes";

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const { t } = useTranslation();
  const active = isActive(item, pathname);
  const Icon = item.icon;
  return (
    <NavLink to={item.to} className={`rail__link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
      {active && (
        <motion.span
          layoutId="rail-marker"
          className="rail__marker"
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
        />
      )}
      <Icon size={18} strokeWidth={1.8} />
      <span>{t(`nav.${item.key}`)}</span>
    </NavLink>
  );
}

function useSessionIo() {
  const [io, setIo] = useState({ ...sessionIo });
  useEffect(() => onIo(() => setIo({ ...sessionIo })), []);
  return io;
}

function ThemeButton() {
  const { t } = useTranslation();
  const theme = settings.use((s) => s.theme);
  const next: Record<Theme, Theme> = { system: "dark", dark: "light", light: "system" };
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : SunMoon;
  return (
    <IconButton
      label={t("settings.themeButton", { theme: t(`settings.theme.${theme}`) })}
      onClick={() => {
        const value = next[theme];
        settings.set({ theme: value });
        applyTheme(value);
      }}
    >
      <Icon size={18} />
    </IconButton>
  );
}

function DbStatus() {
  const { t } = useTranslation();
  const io = useSessionIo();
  const info = useQuery({ queryKey: ["dbinfo"], queryFn: dbInfo, staleTime: Infinity });
  return (
    <div className="db-status">
      <span className={`db-status__dot${info.isError ? " is-error" : info.data ? " is-ok" : ""}`} aria-hidden />
      <span>
        {info.isError
          ? t("db.unreachable")
          : info.data
            ? t("db.updated", { date: formatDate(info.data.dump ?? info.data.built, "short") })
            : t("db.connecting")}
      </span>
      {io.bytes > 0 && <span className="db-status__io num">{t("db.downloaded", { size: formatBytes(io.bytes) })}</span>}
    </div>
  );
}

function SearchTrigger() {
  const { t } = useTranslation();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button className="search-trigger" onClick={() => ui.openPalette()}>
      <Search size={17} />
      <span>{t("palette.trigger")}</span>
      <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}

function Explore() {
  const { t } = useTranslation();
  const open = useUi((s) => s.explore);
  const { pathname } = useLocation();
  useEffect(() => ui.set({ explore: false }), [pathname]);
  return (
    <Sheet open={open} onClose={() => ui.set({ explore: false })} title={t("nav.explore")} side="left">
      <nav className="explore-nav">
        {[...PRIMARY.slice(2), ...SECONDARY, ...FOOTER].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} to={item.to} className={`explore-nav__link${isActive(item, pathname) ? " is-active" : ""}`}>
              <Icon size={20} strokeWidth={1.8} />
              <span>
                <strong>{t(`nav.${item.key}`)}</strong>
                <small>{t(`nav.hint.${item.key}`)}</small>
              </span>
            </Link>
          );
        })}
      </nav>
    </Sheet>
  );
}

function TabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const explore = useUi((s) => s.explore);
  const tabs = [PRIMARY[0], PRIMARY[1], SECONDARY[0]];
  const exploreActive =
    explore || [...PRIMARY.slice(2), SECONDARY[1], ...FOOTER].some((i) => isActive(i, pathname));
  return (
    <nav className="tabbar" aria-label={t("nav.main")}>
      {tabs.slice(0, 2).map((item) => {
        const Icon = item.icon;
        const active = !explore && isActive(item, pathname);
        return (
          <Link key={item.key} to={item.to} className={`tabbar__item${active ? " is-active" : ""}`}>
            <Icon size={21} strokeWidth={1.8} />
            <span>{t(`nav.${item.key}`)}</span>
          </Link>
        );
      })}
      <button className={`tabbar__item${exploreActive ? " is-active" : ""}`} onClick={() => ui.set({ explore: !explore })}>
        <Compass size={21} strokeWidth={1.8} />
        <span>{t("nav.explore")}</span>
      </button>
      {(() => {
        const item = tabs[2];
        const Icon = item.icon;
        const active = !explore && isActive(item, pathname);
        return (
          <Link to={item.to} className={`tabbar__item${active ? " is-active" : ""}`}>
            <Icon size={21} strokeWidth={1.8} />
            <span>{t(`nav.${item.key}`)}</span>
          </Link>
        );
      })()}
    </nav>
  );
}

function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast${t.tone ? ` toast--${t.tone}` : ""}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Raccourcis clavier, ouverts avec « ? ». */
function Shortcuts() {
  const { t } = useTranslation();
  const open = useUi((s) => s.shortcuts);
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const rows: [string[], string][] = [
    [[mod, "K"], t("shortcuts.palette")],
    [["/"], t("shortcuts.palette")],
    [["↑", "↓", t("shortcuts.enter")], t("shortcuts.paletteNav")],
    [["←", "→"], t("shortcuts.issues")],
    [[mod, t("shortcuts.enter")], t("shortcuts.run")],
    [["Esc"], t("shortcuts.close")],
    [["?"], t("shortcuts.help")],
  ];
  return (
    <Dialog open={open} onClose={() => ui.set({ shortcuts: false })} title={t("shortcuts.title")} size="sm">
      <dl className="shortcuts">
        {rows.map(([keys, label], i) => (
          <div key={i}>
            <dt>
              {keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        ui.openPalette();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        ui.openPalette();
      } else if (e.key === "?" && !typing) {
        e.preventDefault();
        ui.set({ shortcuts: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t("nav.skip")}
      </a>
      <aside className="rail" aria-label={t("nav.main")}>
        <Link to={routes.home()} className="rail__brand" aria-label="InducksButBetter">
          <Logo />
        </Link>
        <nav className="rail__nav">
          <div className="rail__group">
            {PRIMARY.map((item) => (
              <RailLink key={item.key} item={item} pathname={pathname} />
            ))}
          </div>
          <div className="rail__group">
            {SECONDARY.map((item) => (
              <RailLink key={item.key} item={item} pathname={pathname} />
            ))}
          </div>
        </nav>
        <div className="rail__foot">
          {FOOTER.map((item) => (
            <RailLink key={item.key} item={item} pathname={pathname} />
          ))}
          <DbStatus />
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <Link to={routes.home()} className="topbar__brand" aria-label="InducksButBetter">
            <Logo />
          </Link>
          <SearchTrigger />
          <div className="topbar__actions">
            <IconButton label={t("palette.trigger")} className="topbar__search" onClick={() => ui.openPalette()}>
              <Search size={19} />
            </IconButton>
            <ThemeButton />
          </div>
        </header>
        <main id="main" className="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-foot">
          <p>
            {t("footer.data")}{" "}
            <a className="link" href="https://inducks.org" target="_blank" rel="noreferrer">
              I.N.D.U.C.K.S.
            </a>{" "}
            {t("footer.disclaimer")}
          </p>
          <p className="muted">
            <Link className="link" to={routes.about()}>
              {t("nav.about")}
            </Link>{" "}
            <span aria-hidden>/</span>{" "}
            <a className="link" href="https://github.com/Jonathan8520/InducksButBetter" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <span className="site-foot__keys">
              {" "}
              <span aria-hidden>/</span>{" "}
              <button type="button" className="link link-button" onClick={() => ui.set({ shortcuts: true })}>
                {t("shortcuts.title")}
              </button>
            </span>
          </p>
        </footer>
      </div>

      <TabBar />
      <Explore />
      <CommandPalette />
      <Shortcuts />
      <Toasts />
    </div>
  );
}
