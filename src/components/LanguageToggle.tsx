import { useTranslation } from "react-i18next"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { SUPPORTED_LANGUAGES, resolveLanguage } from "@/lib/languages"

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const currentLang = resolveLanguage(i18n.resolvedLanguage || i18n.language)

  return (
    <Select value={currentLang.code} onValueChange={(lang) => i18n.changeLanguage(lang)}>
      <SelectTrigger className="w-[auto] sm:w-[150px] px-2.5 sm:px-3 h-10 border-border-subtle bg-surface/80 rounded-xl hover:bg-surface-2 transition-all font-medium text-sm">
        <div className="flex items-center gap-2">
          <img
            src={currentLang.flag}
            className="w-4 h-3 rounded-xs shrink-0 object-cover"
            alt=""
          />
          <span className="truncate hidden sm:inline">{currentLang.name}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border-subtle bg-surface">
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code} className="rounded-lg">
            <div className="flex items-center gap-2">
              <img src={l.flag} className="w-4 h-3 rounded-xs shrink-0 object-cover" alt="" />
              <span>{l.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
