import React, { useState, useRef, useEffect } from "react"
import { Sparkles, X, Send, Volume2, VolumeX, Trash2 } from "lucide-react"
import { useSpeechToText } from "@/hooks/useSpeechToText"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { getApiUrl, fetchJson } from "@/lib/api"
import { DEFAULT_DB_SCHEMA } from "@/lib/defaultSchema"
import { ChatBubble } from "@/components/ChatBubble"
import { SqlCodeBlock } from "@/components/SqlCodeBlock"
import { TypingIndicator } from "@/components/TypingIndicator"
import { MicButton } from "@/components/MicButton"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface AiAssistantProps {
  onCopyToEditor?: (query: string) => void
}

export function AiAssistant({ onCopyToEditor }: AiAssistantProps) {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: t("ai.welcome") },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(false)
  const [modelName, setModelName] = useState<string | null>(null)

  const { isRecording, transcript, toggleRecording } = useSpeechToText()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    fetchJson<{ model?: string }>("/api/llm-status")
      .then((data) => {
        if (active) setModelName(data.model || null)
      })
      .catch(() => {
        if (active) setModelName(null)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  useEffect(() => {
    if (transcript) setInput(transcript)
  }, [transcript])

  useEffect(() => {
    if (
      messages.length === 1 &&
      messages[0].role === "assistant" &&
      messages[0].content !== t("ai.welcome")
    ) {
      setMessages([{ role: "assistant", content: t("ai.welcome") }])
    }
  }, [i18n.language, t, messages])

  const speak = (text: string) => {
    if (!isSpeakingEnabled) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.replace(/```sql[\s\S]*?```/g, ""))
    utterance.lang = i18n.language === "fr" ? "fr-FR" : "en-US"
    window.speechSynthesis.speak(utterance)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const schemaData = await fetchJson<{ tables?: any[] }>("/api/schema")
      const schema = Array.isArray(schemaData.tables)
        ? schemaData.tables
        : Object.entries(DEFAULT_DB_SCHEMA).map(([name, columns]) => ({
            name,
            rowCount: "?",
            columns: columns.map((column) => ({ name: column, type: "TEXT", nullable: true, key: "" })),
          }))

      const data = await fetchJson<{ response: string }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          schema,
          lang: i18n.language,
        }),
      })

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }])
      speak(data.response)
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("ai.error") }])
    } finally {
      setLoading(false)
    }
  }

  /** Render assistant message: splits on ```sql ... ``` blocks */
  const renderAssistantContent = (content: string, msgIndex: number) =>
    content.split("```sql").map((part, idx) => {
      if (idx === 0) return <span key={idx}>{part}</span>
      const [code, ...rest] = part.split("```")
      return (
        <React.Fragment key={idx}>
          <SqlCodeBlock
            code={code.trim()}
            bubbleId={msgIndex * 100 + idx}
            onCopyToEditor={onCopyToEditor}
          />
          {rest.join("```")}
        </React.Fragment>
      )
    })

  return (
    <div className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end gap-2 lg:gap-4 max-w-[calc(100vw-32px)] sm:max-w-none">
      {isOpen && (
        <Card className="w-full sm:w-[400px] h-[500px] sm:h-[600px] max-h-[calc(100vh-100px)] lg:max-h-[600px] shadow-2xl border border-border-subtle flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <CardHeader className="bg-surface-2 text-foreground p-4 shrink-0 flex flex-row items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                {t("ai.title")}
              </CardTitle>
              {modelName && (
                <div className="text-[10px] text-zinc-400 font-medium ml-6">
                  {t("ai.model")}: <span className="text-blue-400/80">{modelName}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10", isSpeakingEnabled && "text-blue-400")}
                onClick={() => {
                  const next = !isSpeakingEnabled
                  setIsSpeakingEnabled(next)
                  if (!next) window.speechSynthesis.cancel()
                }}
                title={isSpeakingEnabled ? t("ai.voice_disable") : t("ai.voice_enable")}
              >
                {isSpeakingEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="p-0 flex-1 flex flex-col min-h-0 bg-surface">
            <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
              <div className="flex flex-col gap-4">
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role}>
                    {m.role === "assistant"
                      ? renderAssistantContent(m.content, i)
                      : m.content}
                  </ChatBubble>
                ))}
                {loading && <TypingIndicator />}
              </div>
            </ScrollArea>

            {/* Input bar */}
            <div className="p-3 bg-surface border-t border-border-subtle flex gap-2 items-center relative">
              {isRecording && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg animate-bounce">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  {t("ai.listening")}
                </div>
              )}
              <MicButton
                isRecording={isRecording}
                onClick={toggleRecording}
                title={t("ai.dictate")}
              />
              <div className="flex-1 relative">
                <Input
                  placeholder={isRecording ? t("ai.listening_placeholder") : t("ai.placeholder")}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className={cn(
                    "w-full h-10 rounded-xl border border-border-subtle bg-surface px-3 focus-visible:ring-primary/20 pr-9 transition-all",
                    isRecording && "border-red-300 bg-red-50/20 placeholder:text-red-400 shadow-inner animate-pulse"
                  )}
                />
                {input && !isRecording && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8 text-zinc-400 hover:text-zinc-600 rounded-lg"
                    onClick={() => setInput("")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20"
                onClick={handleSend}
                disabled={loading || isRecording || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAB toggle button */}
      <Button
        size="icon"
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl transition-all duration-300 active:scale-95",
          isOpen ? "bg-zinc-900 rotate-90" : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/40"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </Button>
    </div>
  )
}
