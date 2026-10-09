import { useState } from "react";
import { BookOpen } from "lucide-react";
import { hue, initials } from "../../lib/text";
import { mediumUrl, thumbUrl } from "../../lib/inducks";

interface CoverProps {
  img: string | null | undefined;
  alt: string;
  /** Taille servie : vignette légère dans les listes, moyenne sur les fiches. */
  quality?: "thumb" | "medium";
  className?: string;
  /** Ratio d'une page de BD par défaut. */
  ratio?: number;
  eager?: boolean;
  seed?: string;
}

/**
 * Une couverture ou une première page. Tant que l'image arrive, une surface neutre au bon
 * ratio réserve la place ; si elle manque ou échoue, un aplat teinté d'après le code évite
 * une grille de trous identiques.
 */
export function Cover({ img, alt, quality = "thumb", className, ratio = 0.74, eager, seed }: CoverProps) {
  const src = quality === "medium" ? mediumUrl(img) : thumbUrl(img);
  // L'état est attaché à une adresse précise : quand l'adresse change, on repart de
  // « loading » sans effet après coup. (Un effet remettait « loading » au retour sur une
  // page, après que l'image en cache avait déjà signalé son chargement : elle restait
  // invisible.)
  const [status, setStatus] = useState<{ src: string | null; state: "loading" | "ok" | "error" }>({
    src,
    state: src ? "loading" : "error",
  });
  const state = status.src === src ? status.state : src ? "loading" : "error";
  const settle = (next: "ok" | "error") => setStatus({ src, state: next });
  // Image déjà dans le cache du navigateur : elle peut être complète avant que l'écouteur
  // de chargement ne serve, on le vérifie à l'insertion.
  const imgRef = (el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0 && state === "loading") settle("ok");
  };
  const h = hue(seed ?? alt);
  return (
    <div
      className={["cover", `cover--${state}`, className].filter(Boolean).join(" ")}
      style={{ aspectRatio: String(ratio), ["--h" as string]: h }}
    >
      {src && state !== "error" && (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          ref={imgRef}
          onLoad={() => settle("ok")}
          onError={() => settle("error")}
        />
      )}
      {state === "error" && (
        <span className="cover__empty" aria-hidden>
          <BookOpen size={20} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}

export function Avatar({ name, code, size = 40 }: { name: string; code: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, ["--h" as string]: hue(code) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
