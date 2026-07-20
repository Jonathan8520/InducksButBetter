import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Save, AlertCircle, Info } from "lucide-react";

interface CollectionManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionManagerDialog({ open, onOpenChange }: CollectionManagerDialogProps) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState("");
  const [issueCount, setIssueCount] = useState(0);

  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem("inducks_collection_issues");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setInputText(parsed.join("\n"));
            setIssueCount(parsed.length);
          }
        } else {
          setInputText("");
          setIssueCount(0);
        }
      } catch (e) {
        console.error("Failed to parse saved collection", e);
      }
    }
  }, [open]);

  const handleSave = () => {
    // Extract non-empty lines, trim them
    const issues = inputText
      .split(/[\n;]+/)
      .map(line => {
        const trimmed = line.trim();
        if (trimmed.includes("^")) {
          const parts = trimmed.split("^");
          if (parts.length >= 2 && parts[0] && parts[1]) {
            return `${parts[0].trim().toUpperCase()}/${parts[1].trim()}`;
          }
        }
        return trimmed;
      })
      .filter(line => line.length > 0);
    
    localStorage.setItem("inducks_collection_issues", JSON.stringify(issues));
    setIssueCount(issues.length);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[200]">
        <DialogHeader>
          <DialogTitle>{t('collection.title')}</DialogTitle>
          <DialogDescription>
            {t('collection.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-blue-500/10 text-blue-500 text-sm border border-blue-500/20">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <p leading-relaxed>{t('collection.alert_unavailable')}</p>
          </div>
          
          <textarea
            className="flex min-h-[200px] w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 font-mono"
            placeholder={t('collection.placeholder')}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          {issueCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-2 p-2 rounded-md">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span>{t('collection.saved_count', { count: issueCount })}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('collection.cancel')}
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            {t('collection.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
