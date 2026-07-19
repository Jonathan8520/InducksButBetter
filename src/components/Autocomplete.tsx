import * as React from "react"
import { Check, ChevronDown, LibraryBig, Loader2, User, X, BookOpen } from "lucide-react"
import { AvatarWithFallback } from "./AvatarWithFallback"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getApiUrl } from "@/lib/api"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface AutocompleteProps {
  placeholder: string
  emptyMessage: string
  fetchOptions: (query: string) => Promise<any[]>
  onSelect: (value: string, label: string) => void
  onInputChange?: (value: string) => void
  onClear?: () => void
  type?: "characters" | "authors" | "stories" | "publishers"
  hideIcon?: boolean
  hideSearchIcon?: boolean
  showClear?: boolean
  value?: string
}

export function Autocomplete({ placeholder, emptyMessage, fetchOptions, onSelect, onClear, showClear = true, hideIcon = false, hideSearchIcon = false, onInputChange, type, value }: AutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (value !== undefined) {
      setQuery(value)
      if (!value) setSelectedLabel(null)
    }
  }, [value])

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

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedLabel(null)
    setQuery("")
    setItems([])
    onClear?.()
  }

  const handleSelect = (id: string, name: string) => {
    // For stories, we want to display the code (id)
    const displayValue = type === "stories" ? id : name
    setSelectedLabel(displayValue)
    setQuery(displayValue)
    onSelect(id, name)
    setOpen(false)
  }

  return (
    <div className="relative w-full">
      <Popover open={open && (items.length > 0 || loading)} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center w-full">
            <Input
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                const val = e.target.value
                setQuery(val)
                if (val.length >= 2) setOpen(true)
                
                // Call onInputChange if provided (for manual typing)
                if (onInputChange) onInputChange(val)
                
                if (selectedLabel && val !== selectedLabel) {
                   setSelectedLabel(null)
                }
              }}
              onFocus={() => {
                if (query.length >= 2) setOpen(true)
              }}
              className="w-full h-10 pr-10 rounded-xl border border-border-subtle bg-surface text-text-body shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all hover:bg-surface-2 placeholder:text-text-hint"
            />
            <div className="absolute right-3 flex items-center gap-2">
              {query && showClear && (
                <button
                  type="button"
                  className="text-text-secondary hover:text-text-body transition-colors p-0.5"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
              ) : (
                !hideSearchIcon && <ChevronDown className="h-4 w-4 text-text-secondary opacity-70" />
              )}
            </div>
          </div>
        </PopoverTrigger>
         <PopoverContent 
          className="p-0 w-[var(--radix-popover-trigger-width)] z-[100]" 
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="bottom"
          align="start"
          sideOffset={8}
        >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandGroup>
                {items.map((item) => {
                  const id = item.charactercode || item.personcode || item.storycode || item.publisherid;
                  let name = item.charactername || item.fullname || item.storyname || item.publishername || item.storycode;
                  
                  // For stories, the ID (code) is what users usually search for
                  if (type === "stories") {
                    name = id;
                  }
                  
                  let imageUrl = "";
                  if (item.personcode) {
                    const formattedCode = item.personcode.replace(/ /g, "_");
                    imageUrl = `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/creators/photos/${formattedCode}.jpg`)}`;
                  }
                  else if (item.charactercode) {
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
                  } else if (item.storycode && item.story_thumb) {
                    const parts = item.story_thumb.split('|');
                    const url = parts.length > 1 ? parts[1] : parts[0];
                    let baseUrl = url;
                    if (!url.startsWith('http')) {
                      if (parts[0] === 'webusers' && !url.startsWith('webusers/')) {
                        baseUrl = `https://outducks.org/webusers/webusers/${url}`;
                      } else {
                        baseUrl = `https://outducks.org/${url.startsWith('/') ? url.substring(1) : url}`;
                      }
                    }
                    imageUrl = `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=${baseUrl}`)}`;
                  }

                  return (
                    <CommandItem
                      key={id}
                      value={id}
                      onSelect={() => handleSelect(id, name)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(id, name);
                      }}
                      disabled={false}
                      className="cursor-pointer rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 aria-selected:bg-surface-2 hover:bg-surface-2"
                    >
                      <div className="flex items-center gap-3 w-full">
                        {!hideIcon && (
                          imageUrl ? (
                            <AvatarWithFallback
                              src={imageUrl}
                              name={name}
                              className="w-8 h-8"
                              textClasses="text-[12px]"
                              square={type === "stories"}
                            />
                          ) : (
                            <div className={`w-8 h-8 ${type === "stories" ? "rounded-md" : "rounded-full"} bg-surface-2 flex items-center justify-center shrink-0 border border-border-subtle`}>
                              {type === "stories" ? (
                                <BookOpen className="w-4 h-4 text-text-secondary" />
                              ) : item.publisherid ? (
                                <LibraryBig className="w-4 h-4 text-text-secondary" />
                              ) : (
                                <User className="w-4 h-4 text-text-secondary" />
                              )}
                            </div>
                          )
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-sm font-medium text-text-body">{name}</span>
                          {(id !== name || (type === "stories" && item.storyname)) && (
                            <span className="text-[10px] text-text-secondary font-mono italic truncate">
                              {type === "stories" ? item.storyname : id}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
