import { cn } from "@/lib/utils"

interface ChatBubbleProps {
  role: "user" | "assistant"
  children: React.ReactNode
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl p-3 text-sm flex flex-col gap-2 animate-spring-pop",
        role === "user"
          ? "bg-blue-600 text-white self-end rounded-tr-none shadow-md"
          : "bg-surface border border-border-subtle text-text-body self-start rounded-tl-none shadow-sm"
      )}
    >
      <div className="whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  )
}
