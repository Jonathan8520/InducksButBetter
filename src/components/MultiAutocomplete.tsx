import * as React from "react"
import { Check, ChevronDown, LibraryBig, Loader2, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

interface MultiAutocompleteProps {
  placeholder: string
  emptyMessage: string
  fetchOptions: (query: string) => Promise<any[]>
  selected: string[]
  selectedLabels: Record<string, string>
  onSelect: (value: string, label: string) => void
  onRemove: (value: string) => void
  onClear: () => void
  type?: "characters" | "authors" | "publishers"
  maxDisplay?: number
}

export function MultiAutocomplete({
  placeholder,
  emptyMessage,
  fetchOptions,
  selected,
  selectedLabels,
  onSelect,
  onRemove,
  onClear,
  type = "characters",
  maxDisplay = 3,
}: MultiAutocompleteProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (query.length < 2) {
      setItems([])
      setLoading(false)
      return
    }

    let isActive = true;
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await fetchOptions(query)
        if (isActive) setItems(data)
      } catch (err) {
        console.error(err)
      } finally {
        if (isActive) setLoading(false)
      }
    }, 300)

    return () => {
      isActive = false;
      clearTimeout(timer)
    }
  }, [query, fetchOptions])

  const handleSelect = (id: string, name: string) => {
    if (!selected.includes(id)) {
      onSelect(id, name)
    }
    setQuery("")
    setItems([])
    // We don't close the popover to allow multiple selections easily, 
    // but usually in this UX it's better to close or clear the search.
    setOpen(false)
  }

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove(id)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClear()
    setQuery("")
  }

  return (
    <Popover open={open && (query.length >= 2 || items.length > 0 || loading)} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal h-auto min-h-10 px-3 py-1.5 rounded-xl bg-surface border border-border-subtle shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2 flex-wrap overflow-hidden"
          onClick={() => {}}
        >
          <div className="flex flex-wrap gap-1.5 flex-1 text-left min-w-0">
            {selected.slice(0, maxDisplay).map((id) => (
              <Badge
                key={id}
                variant="secondary"
                className="bg-surface-2 text-text-body shadow-sm border border-border-subtle hover:border-border transition-all text-[10px] font-bold tracking-tight rounded-lg px-2 py-0.5 flex items-center gap-1 group shrink-0"
              >
                <span>{selectedLabels[id] || id}</span>
                <span
                  className="cursor-pointer text-text-secondary hover:text-destructive transition-colors -mr-1 p-0.5"
                  onMouseDown={(e) => handleRemove(id, e)}
                >
                  <X className="w-3 h-3" />
                </span>
              </Badge>
            ))}
             
            {selected.length > maxDisplay && (
              <Badge variant="secondary" className="bg-surface-2 border border-dashed border-border-subtle text-text-secondary shadow-sm text-[10px] font-bold rounded-lg px-2 py-0.5 flex items-center h-5">
                +{selected.length - maxDisplay}
              </Badge>
            )}

            <input
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-text-secondary min-w-[60px]"
              placeholder={selected.length > 0 ? "" : placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (e.target.value.length >= 2) setOpen(true)
              }}
              onFocus={() => {
                if (query.length >= 2) setOpen(true)
              }}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selected.length > 0 && (
               <span 
                 className="text-text-secondary hover:text-text-body transition-colors p-1 hover:bg-surface-2 rounded-md"
                 onMouseDown={handleClear}
               >
                 <X className="h-4 w-4" />
               </span>
            )}
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-secondary opacity-70 shrink-0" />
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command shouldFilter={false}>
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>{loading ? t?.('common.loading') || "Chargement..." : emptyMessage}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const id = item.charactercode || item.personcode || item.storycode || item.publisherid;
                const name = item.charactername || item.fullname || item.storyname || item.publishername || item.storycode;
                
                let imageUrl = "";
                if (item.personcode) {
                  const formattedCode = item.personcode.replace(/ /g, "_");
                  imageUrl = `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/creators/photos/${formattedCode}.jpg`)}`;
                } else if (item.charactercode) {
                  if (item.imageUrl) {
                    const [site, path] = item.imageUrl.split('|');
                    if (site === 'webusers') {
                      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                      const finalPath = cleanPath.startsWith('webusers/') ? cleanPath : `webusers/${cleanPath}`;
                      imageUrl = `/api/proxy-image?url=${encodeURIComponent(`https://outducks.org/webusers/${finalPath}`)}`;
                    }
                  }
                  if (!imageUrl) {
                    imageUrl = `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/characterthumb.php?c=${item.charactercode}`)}`;
                  }
                }

                return (
                  <CommandItem
                    key={id}
                    value={id}
                    onSelect={() => handleSelect(id, name)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-3 w-full">
                      {imageUrl ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-surface-2 border border-border-subtle">
                          <img 
                            src={imageUrl} 
                            alt="" 
                            className="w-full h-full object-cover"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center shrink-0 border border-border-subtle">
                           <User className="w-4 h-4 text-text-secondary" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-medium text-text-body">{name}</span>
                        {id !== name && (
                          <span className="text-[10px] text-text-secondary font-mono italic truncate">
                            {id}
                          </span>
                        )}
                      </div>
                      {selected.includes(id) && <Check className="ml-auto w-4 h-4 text-primary" />}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
