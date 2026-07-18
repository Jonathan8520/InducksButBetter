import { Mic, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MicButtonProps {
  isRecording: boolean
  onClick: () => void
  title?: string
}

/**
 * Microphone button with ripple wave animation while recording.
 * Shows ripple rings emanating outward when active.
 */
export function MicButton({ isRecording, onClick, title }: MicButtonProps) {
  return (
    <div className="relative shrink-0">
      {/* Ripple rings while recording */}
      {isRecording && (
        <>
          <span className="absolute inset-0 rounded-xl bg-red-400 animate-ripple" />
          <span className="absolute inset-0 rounded-xl bg-red-400 animate-ripple" style={{ animationDelay: "0.4s" }} />
        </>
      )}
      <Button
        size="icon"
        variant="outline"
        className={cn(
          "h-10 w-10 relative border border-border-subtle rounded-xl bg-surface transition-all duration-300 z-10 hover:bg-surface-2",
          isRecording && "bg-red-100/20 border-red-300 text-red-600 dark:bg-red-500/15 dark:text-red-300 scale-110 shadow-xl shadow-red-500/10 ring-2 ring-red-500/20"
        )}
        onClick={onClick}
        title={title}
      >
        {isRecording ? (
          <Square className="w-4 h-4 fill-red-600" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>
    </div>
  )
}
