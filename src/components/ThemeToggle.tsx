import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const options = [
    { value: "light", icon: Sun, label: t("theme.light") },
    { value: "dark", icon: Moon, label: t("theme.dark") },
    { value: "system", icon: Monitor, label: t("theme.system") },
  ] as const

  const currentOption = options.find((option) => option.value === theme) ?? options[2]
  const CurrentIcon = currentOption.icon

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system") }>
      <SelectTrigger
        className="w-full sm:w-[140px] h-10 border-border-subtle bg-surface/80 rounded-xl hover:bg-surface-2 transition-all font-medium text-sm"
        aria-label={t("theme.label")}
      >
        <div className="flex items-center gap-2">
          <CurrentIcon className="w-4 h-4" />
          <span>{currentOption.label}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border-subtle bg-surface">
        {options.map(({ value, icon: Icon, label }) => (
          <SelectItem key={value} value={value} className="rounded-lg">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
