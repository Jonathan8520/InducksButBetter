import React, { useState, useRef, useEffect } from "react"
import { Sparkles, X, Send, Volume2, VolumeX, Trash2, Loader2 } from "lucide-react"
import { useSpeechToText } from "@/hooks/useSpeechToText"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { DEFAULT_DB_SCHEMA } from "@/lib/defaultSchema"
import { useWebLLM, DEFAULT_MODEL } from "@/lib/useWebLLM"
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
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(false)
  const [modelName, setModelName] = useState<string | null>(null)

  const { engine, loading: webllmLoading, progressText, progressPercent, isCached, init, generate } = useWebLLM()
  const [hasStartedDownload, setHasStartedDownload] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const { isRecording, transcript, toggleRecording } = useSpeechToText()
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  useEffect(() => {
    setModelName(DEFAULT_MODEL)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      // If we are within 50px of the bottom, we keep auto-scrolling
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50
    }

    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [isOpen])

  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen && isCached && !engine && !hasStartedDownload) {
      setHasStartedDownload(true)
      init()
    }
  }, [isOpen, isCached, engine, hasStartedDownload, init])

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
    if (isRecording) {
      toggleRecording()
    }
    
    if (!input.trim() || webllmLoading || isGenerating) return

    const userMessage: Message = { role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsGenerating(true)

    try {
      // Only send core tables to avoid confusing the small AI model
      const coreTables = ['inducks_story', 'inducks_storyversion', 'inducks_character', 'inducks_person', 'inducks_publication', 'inducks_issue', 'inducks_storyjob', 'inducks_appearance'];
      const schemaString = Object.entries(DEFAULT_DB_SCHEMA)
        .filter(([name]) => coreTables.includes(name))
        .map(([name, columns]) => `${name}(${columns.join(",")})`)
        .join("; ");

      const systemPrompt = `Tu es un expert SQL pour la base de données Inducks (Disney comics).
Schéma (simplifié) :
${schemaString}

Relations clés :
- inducks_story.storycode = inducks_storyversion.storycode
- inducks_storyjob.storyversioncode = inducks_storyversion.storyversioncode
- inducks_storyjob.personcode = inducks_person.personcode
- inducks_appearance.storyversioncode = inducks_storyversion.storyversioncode
- inducks_appearance.charactercode = inducks_character.charactercode

Exemples de requêtes :
Q: "Histoires écrites par Carl Barks"
R: \`\`\`sql
SELECT s.title, p.fullname FROM inducks_story s 
JOIN inducks_storyversion sv ON s.storycode = sv.storycode 
JOIN inducks_storyjob sj ON sv.storyversioncode = sj.storyversioncode 
JOIN inducks_person p ON sj.personcode = p.personcode 
WHERE p.fullname LIKE '%Barks%' LIMIT 10;
\`\`\`
Q: "Histoires avec Picsou"
R: \`\`\`sql
SELECT s.title FROM inducks_story s 
JOIN inducks_storyversion sv ON s.storycode = sv.storycode 
JOIN inducks_appearance a ON sv.storyversioncode = a.storyversioncode 
JOIN inducks_character c ON a.charactercode = c.charactercode 
WHERE c.charactername LIKE '%Scrooge%' LIMIT 10;
\`\`\`

RÈGLES ABSOLUES :
1. Comprends la demande PEU IMPORTE LA LANGUE (français, anglais, etc.).
2. Tu ne dois générer QUE du code SQL SQLite valide.
3. PAS d'explications ni de texte. TOUJOURS un bloc \`\`\`sql ... \`\`\`.`

      // Prepare an empty bubble for the assistant's response
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      // Intercept messages to inject the strict instruction into the final user message
      const messagesToWebLLM = [...messages]
      messagesToWebLLM.push({ 
        role: "user", 
        content: `Requête utilisateur : ${input}\n\n-> IMPORTANT: Réponds UNIQUEMENT par la requête SQL dans un bloc \`\`\`sql. AUCUN AUTRE TEXTE.` 
      })

      const responseText = await generate(messagesToWebLLM, systemPrompt, (currentText) => {
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastIndex = newMessages.length - 1
          newMessages[lastIndex] = { ...newMessages[lastIndex], content: currentText }
          return newMessages
        })
      })

      speak(responseText)
    } catch (e) {
      console.error(e)
      setMessages((prev) => [...prev, { role: "assistant", content: t("ai.error") }])
    } finally {
      setIsGenerating(false)
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
                <Sparkles className="w-4 h-4 text-primary" />
                {t("ai.title")}
              </CardTitle>
              {modelName && (
                <div className="text-[10px] text-text-hint font-medium ml-6">
                  {t("ai.model")}: <span className="text-primary/80">{modelName}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 text-text-hint hover:text-white hover:bg-white/10", isSpeakingEnabled && "text-primary")}
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
                className="h-8 w-8 text-text-hint hover:text-white hover:bg-white/10"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="p-0 flex-1 flex flex-col min-h-0 bg-surface relative">
            {!engine && (
              <div className="absolute inset-0 z-10 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative">
                  <div className={cn("absolute inset-0 bg-primary blur-xl opacity-20 rounded-full transition-opacity duration-1000", hasStartedDownload ? "opacity-50 animate-pulse" : "opacity-0")} />
                  <Sparkles className={cn("w-12 h-12 text-primary mb-4 relative z-10 transition-transform duration-700", hasStartedDownload && "scale-110 animate-pulse")} />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{t("ai.activate_title")}</h3>
                <p className="text-sm text-text-hint mb-8 max-w-[250px]">
                  {t("ai.activate_desc", { 
                    size: modelName === 'Llama-3.2-3B-Instruct-q4f32_1-MLC' ? '(~1.8 Go) ' : 
                          modelName === 'TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC' ? '(~600 Mo) ' : 
                          modelName === 'Llama-3.2-1B-Instruct-q4f32_1-MLC' ? '(~850 Mo) ' :
                          ''
                  })}
                </p>
                {!hasStartedDownload ? (
                  <Button 
                    className="w-full bg-primary hover:bg-primary text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all duration-300 hover:-translate-y-0.5 rounded-xl"
                    onClick={() => {
                      setHasStartedDownload(true)
                      init()
                    }}
                  >
                    {t("ai.activate_btn")}
                  </Button>
                ) : (
                  <div className="w-full flex flex-col gap-3 animate-in slide-in-from-bottom-2 fade-in duration-500">
                    <div className="flex justify-between items-center text-xs font-medium text-text-hint">
                      <span className="flex items-center gap-2 truncate pr-4">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                        <span className="truncate">{progressText === 'Initialisation...' ? t("ai.preparation") : progressText}</span>
                      </span>
                      <span className="tabular-nums font-bold text-primary shrink-0">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-3/50 rounded-full overflow-hidden border border-border/50 shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary transition-all duration-300 ease-out relative" 
                        style={{ width: `${progressPercent}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
              <div className="flex flex-col gap-4">
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role}>
                    {m.role === "assistant"
                      ? renderAssistantContent(m.content, i)
                      : m.content}
                  </ChatBubble>
                ))}
                {isGenerating && <TypingIndicator />}
              </div>
            </ScrollArea>

            {/* Input bar */}
            {engine && (
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
                      className="absolute right-1 top-1 h-8 w-8 text-text-hint hover:text-text-secondary rounded-lg"
                      onClick={() => setInput("")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 bg-primary hover:bg-primary rounded-xl shadow-lg shadow-primary/20"
                  onClick={handleSend}
                  disabled={webllmLoading || isGenerating || !input.trim() || !engine}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* FAB toggle button */}
      <Button
        size="icon"
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl transition-all duration-300 active:scale-95",
          isOpen ? "bg-surface-invert rotate-90" : "bg-primary hover:bg-primary hover:shadow-primary/30"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </Button>
    </div>
  )
}
