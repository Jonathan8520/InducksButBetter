import type { ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

export function Skeleton({ w, h = 14, r, className }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  return <span className={["skeleton", className].filter(Boolean).join(" ")} style={{ width: w, height: h, borderRadius: r }} aria-hidden />;
}

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span className="spinner" role="status" style={{ width: size, height: size }}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

/** Erreur explicite : ce qui s'est passé, et un moyen de réessayer. */
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error ?? "");
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="empty empty--error" role="alert">
      <div className="empty__icon">
        <AlertTriangle size={22} />
      </div>
      <h3>{offline ? t("errors.offlineTitle") : t("errors.title")}</h3>
      <p className="muted">{offline ? t("errors.offline") : t("errors.body")}</p>
      {message && !offline && <code className="empty__detail">{message}</code>}
      {retry && (
        <div className="empty__action">
          <Button icon={<RotateCcw size={16} />} onClick={retry}>
            {t("common.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function NotFound({ what, children }: { what: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Empty title={t("errors.notFound", { what })} action={children}>
      {t("errors.notFoundBody")}
    </Empty>
  );
}
