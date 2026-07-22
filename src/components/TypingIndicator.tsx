import { cn } from "@/lib/utils"

/** Three bouncing dots typing indicator for the AI assistant */
export function TypingIndicator() {
  return (
    <div className="bg-white text-text-hint self-start rounded-2xl rounded-tl-none border border-border-subtle shadow-sm px-4 py-3 flex items-center gap-1.5 animate-spring-pop">
      <span className="animate-typing-dot" style={{ animationDelay: "0ms" }} />
      <span className="animate-typing-dot" style={{ animationDelay: "150ms" }} />
      <span className="animate-typing-dot" style={{ animationDelay: "300ms" }} />
    </div>
  )
}
