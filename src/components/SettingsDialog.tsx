import { lazy, Suspense } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, Loader2 } from "lucide-react"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const Settings = lazy(() =>
  import("@/components/Settings").then((m) => ({ default: m.Settings })),
)

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Les réglages en surcouche, plutôt qu'en onglet plein écran.
 *
 * Ils occupaient auparavant une destination à part entière, qui masquait la barre
 * d'onglets et remplaçait la page : on perdait le contexte, et on ne savait plus d'où l'on
 * venait. Un réglage est une parenthèse, pas un endroit où l'on se rend.
 *
 * Radix fournit le piège de focus, la fermeture par Échap et le clic sur le voile ; on
 * n'ajoute que le flou d'arrière-plan et les animations d'entrée/sortie.
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Voile : le flou laisse deviner la page derrière, ce qui garde le contexte
            visible au lieu de le masquer. */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-surface-invert/25 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(46rem,calc(100vw-2rem))]",
            "max-h-[min(46rem,calc(100vh-4rem))] -translate-x-1/2 -translate-y-1/2",
            "flex flex-col overflow-hidden rounded-2xl border border-border",
            "bg-card shadow-2xl",
            // Entrée et sortie : une montée courte accompagnée d'un léger zoom. Les durées
            // restent brèves — une modale de réglages ne doit pas se faire attendre.
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "duration-150 ease-out",
          )}
        >
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>
              {String(t("settings.title", { defaultValue: "Paramètres" }))}
            </DialogPrimitive.Title>
          </VisuallyHidden.Root>

          <DialogPrimitive.Close
            className="absolute right-4 top-4 z-10 rounded-lg p-2 text-text-hint transition-colors
                       hover:bg-surface-2 hover:text-foreground
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={String(t("common.close", { defaultValue: "Fermer" }))}
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          {/* Le contenu défile à l'intérieur de la modale : c'est le seul endroit où un
              conteneur défilant dédié se justifie, puisque la modale a une hauteur bornée. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Suspense
              fallback={
                <div className="flex min-h-[16rem] items-center justify-center text-primary/40">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              }
            >
              <Settings />
            </Suspense>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
