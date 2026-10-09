/**
 * Fenêtres superposées : dialogue centré et panneau latéral (ou tiroir bas sur mobile).
 * Animations à ressort, fermeture par Échap, par le fond ou en glissant le tiroir vers le
 * bas ; le focus est piégé dans le panneau puis rendu à l'élément d'origine.
 */
import { AnimatePresence, motion, type PanInfo, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "./Button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useOverlayBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const el = panel.current;
      if (!el) return;
      const target = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? el).focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (x) => x.offsetParent !== null,
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, panel]);
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Pas d'en-tête : le contenu gère son propre titre (palette de recherche). */
  bare?: boolean;
  labelledBy?: string;
}

export function Dialog({ open, onClose, title, children, size = "md", className, bare, labelledBy }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const reduce = useReducedMotion();
  const { t } = useTranslation();
  useOverlayBehaviour(open, onClose, panel);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="overlay" key="dialog">
          <motion.div
            className="overlay__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy ?? (title ? id : undefined)}
            tabIndex={-1}
            className={["dialog", `dialog--${size}`, className].filter(Boolean).join(" ")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.8 }}
          >
            {!bare && (
              <header className="dialog__head">
                <h2 id={id}>{title}</h2>
                <IconButton label={t("common.close")} onClick={onClose}>
                  <X size={18} />
                </IconButton>
              </header>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Côté d'apparition sur grand écran ; sur mobile, toujours un tiroir bas. */
  side?: "right" | "left";
  footer?: ReactNode;
}

export function Sheet({ open, onClose, title, children, side = "right", footer }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const reduce = useReducedMotion();
  const { t } = useTranslation();
  const controls = useDragControls();
  useOverlayBehaviour(open, onClose, panel);
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 719px)").matches;
  const from = mobile ? { y: "100%" } : { x: side === "right" ? "100%" : "-100%" };
  const to = mobile ? { y: 0 } : { x: 0 };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="overlay overlay--sheet" key="sheet">
          <motion.div
            className="overlay__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? id : undefined}
            tabIndex={-1}
            className={`sheet sheet--${mobile ? "bottom" : side}`}
            initial={reduce ? { opacity: 0 } : from}
            animate={reduce ? { opacity: 1 } : to}
            exit={reduce ? { opacity: 0 } : from}
            transition={{ type: "spring", stiffness: 420, damping: 42, mass: 0.9 }}
            drag={mobile && !reduce ? "y" : false}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {mobile && (
              <div className="sheet__grip" aria-hidden onPointerDown={(e) => controls.start(e)} />
            )}
            <header className="sheet__head" onPointerDown={(e) => mobile && controls.start(e)}>
              <h2 id={id}>{title}</h2>
              <IconButton label={t("common.close")} onClick={onClose}>
                <X size={18} />
              </IconButton>
            </header>
            <div className="sheet__body">{children}</div>
            {footer && <footer className="sheet__foot">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
