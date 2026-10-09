import { useEffect, useRef, useState } from "react";

/**
 * Vrai dès que l'élément approche de l'écran (200 px d'avance), et le reste.
 * Les sections du bas de page attendent ce signal avant d'interroger la base.
 */
export function useInView<T extends Element>(margin = "200px 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}
