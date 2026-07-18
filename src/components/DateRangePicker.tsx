"use client"

import * as React from "react"
import { format, subDays, startOfYear, endOfYear, subYears, startOfMonth, endOfMonth } from "date-fns"
import { fr, enUS } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTranslation } from "react-i18next"

interface DateRangePickerProps {
  className?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}

export function DateRangePicker({
  className,
  date,
  setDate,
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation();

  const currentYear = new Date().getFullYear();
  const presets = [
    { label: t('dates.any_time') || "Toute période", value: undefined },
    { label: t('dates.last_year') || "Dernière année", value: { from: subDays(new Date(), 365), to: new Date() } },
    { label: `${currentYear}`, value: { from: startOfYear(new Date(currentYear, 0, 1)), to: endOfYear(new Date(currentYear, 11, 31)) } },
    { label: "2020s", value: { from: startOfYear(new Date(2020, 0, 1)), to: endOfYear(new Date(2029, 11, 31)) } },
    { label: "2010s", value: { from: startOfYear(new Date(2010, 0, 1)), to: endOfYear(new Date(2019, 11, 31)) } },
    { label: "2000s", value: { from: startOfYear(new Date(2000, 0, 1)), to: endOfYear(new Date(2009, 11, 31)) } },
    { label: "Gold Age (1938-1956)", value: { from: new Date(1938, 5, 1), to: new Date(1956, 11, 31) } },
  ];

  const [month, setMonth] = React.useState<Date | undefined>(date?.from);

  React.useEffect(() => {
    if (date?.from) {
      setMonth(date.from);
    }
  }, [date?.from]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full h-10 justify-start text-left font-normal rounded-xl border border-border-subtle bg-surface text-text-body hover:bg-surface-2 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span className="text-zinc-400 truncate">{t('search.all_periods')}</span>
            )}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border border-border-subtle bg-surface" align="start">
          <div className="flex flex-col md:flex-row">
            <div className="p-4 border-b md:border-b-0 md:border-r border-border-subtle min-w-[200px] bg-surface-2/90">
              <h4 className="text-xs font-bold text-text-hint uppercase tracking-widest mb-4 px-2">Presets</h4>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    className="justify-start font-medium text-xs h-8 rounded-lg hover:bg-surface hover:shadow-sm transition-all"
                    onClick={() => {
                      setDate(preset.value)
                      if (preset.value?.from) {
                        setMonth(preset.value.from)
                      }
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <Calendar
              initialFocus
              mode="range"
              month={month}
              onMonthChange={setMonth}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              locale={i18n.language === 'fr' ? fr : enUS}
              captionLayout="dropdown-buttons"
              fromYear={1930}
              toYear={currentYear + 2}
              classNames={{
                caption_label: "hidden",
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
