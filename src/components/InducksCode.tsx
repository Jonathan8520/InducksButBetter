import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

interface InducksCodeProps {
  code: string
  /** Masque le bouton de copie — utile dans une liste dense. */
  plain?: boolean
  className?: string
}

/**
 * Affiche un code Inducks (`W OS  178-02`, `fr/PM 1`).
 *
 * Ces codes sont des identifiants, pas de la prose : ils comportent des espaces
 * significatifs et se comparent colonne par colonne. Une chasse fixe les rend lisibles et
 * alignés, et `whitespace-pre` empêche le navigateur de replier les espaces multiples —
 * ce qui changerait le code affiché.
 *
 * Le bouton de copie existe parce que c'est l'usage réel : un collectionneur recopie ces
 * codes vers Inducks, un tableur ou un forum.
 */
export function InducksCode({ code, plain = false, className }: InducksCodeProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : on ne fait rien
      // plutôt que d'afficher une erreur pour une commodité.
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1 align-middle", className)}>
      <code className="font-mono text-[0.92em] whitespace-pre tracking-tight text-text-secondary">
        {code}
      </code>
      {!plain && (
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Code copié" : `Copier le code ${code}`}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity
                     text-text-hint hover:text-primary rounded p-0.5"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </span>
  )
}
