import { Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "./ui/Button";
import { ui } from "../lib/ui";

/** Partage natif sur téléphone, copie du lien ailleurs. */
export function ShareButton({ title }: { title: string }) {
  const { t } = useTranslation();
  const share = async () => {
    const url = window.location.href;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* partage annulé */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      ui.toast(t("common.linkCopied"), "ok");
    } catch {
      ui.toast(url);
    }
  };
  return (
    <IconButton label={t("common.share")} onClick={share}>
      <Share2 size={17} />
    </IconButton>
  );
}
