import { useRef, useState } from "react"
import { loadFromIsvFiles, hasLocalDb, getLocalDbStats } from "@/lib/localDb"
import { Database, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useTranslation, Trans } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function LocalDbUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isActive, setIsActive] = useState(hasLocalDb())
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useTranslation()

  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const stats = getLocalDbStats()

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsLoading(true)
    setProgressMsg(t('localDb.progress_start'))
    try {
      await loadFromIsvFiles(Array.from(files), (progress) => {
        setProgressMsg(t('localDb.progress_importing', { table: progress.table, current: progress.current, total: progress.total }))
      })
      setIsActive(true)
      setIsOpen(false)
      toast.success(t('localDb.success') || "Local ISV database loaded successfully!")
    } catch (error) {
      console.error(error)
      toast.error(t('localDb.error') || "Failed to load ISV database.")
    } finally {
      setIsLoading(false)
      setProgressMsg(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className={`flex items-center gap-2 px-3 py-2 h-10 text-sm font-medium rounded-xl border transition-all ${
            isActive && !isLoading
              ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20" 
              : isLoading 
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-surface/80 text-muted-foreground border-border-subtle hover:bg-surface-2 hover:text-foreground"
          }`}
          title={isActive ? t('localDb.tooltip_active') : t('localDb.tooltip_upload')}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isActive ? (
            <Database className="w-4 h-4" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {isLoading ? "Importing..." : isActive ? t('localDb.btn_local') : t('localDb.btn_import')}
          </span>
        </button>
      </DialogTrigger>
      
      <DialogContent 
        className="w-[calc(100%-2rem)] sm:max-w-md rounded-xl"
      >
        <DialogHeader>
          <DialogTitle>{t('localDb.title')}</DialogTitle>
          <DialogDescription className="pt-2 space-y-3" asChild>
            <div>
              <div>
                {t('localDb.desc_1')}
              </div>
              <div>
                <Trans i18nKey="localDb.desc_2" components={{ 1: <code /> }} />
              </div>
              {isActive && (
                <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm">
                  <p>{t('localDb.already_imported')}</p>
                  {stats && (
                    <p className="mt-1 opacity-90 font-medium">
                      {t('localDb.imported_stats', { count: stats.count, size: formatBytes(stats.size) })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".isv"
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {t('localDb.btn_select')}
          </Button>
          {isLoading && progressMsg && (
            <p className="text-sm text-center text-muted-foreground animate-pulse">
              {progressMsg}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
