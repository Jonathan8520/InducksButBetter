import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Facts, Page, PageHead, Section } from "../components/page";
import { Field, Input, Segmented, Select } from "../components/ui/Controls";
import { applyTheme, settings, type AiProvider, type Theme } from "../lib/store";
import { LANGUAGES } from "../i18n";
import { defaultModel, PROVIDER_IDS } from "../lib/ai";
import { dbInfo } from "../data/home";
import { resetLocalizedNames } from "../data/names";
import { formatBytes, formatDate, formatNumber } from "../lib/format";
import { routes } from "../lib/routes";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const s = settings.use((x) => x);
  const client = useQueryClient();
  const info = useQuery({ queryKey: ["dbinfo"], queryFn: dbInfo, staleTime: Infinity });

  return (
    <Page title={t("settings.title")}>
      <PageHead title={t("settings.title")} />

      <Section title={t("settings.display")}>
        <div className="form-grid">
          <Field label={t("settings.language")} hint={t("settings.languageHint")}>
            <Select
              value={i18n.resolvedLanguage}
              onChange={(e) => {
                void i18n.changeLanguage(e.target.value).then(() => {
                  resetLocalizedNames();
                  void client.invalidateQueries();
                });
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("settings.themeLabel")}>
            <Segmented
              label={t("settings.themeLabel")}
              value={s.theme}
              onChange={(v: Theme) => {
                settings.set({ theme: v });
                applyTheme(v);
              }}
              items={[
                { value: "system", label: t("settings.theme.system") },
                { value: "light", label: t("settings.theme.light") },
                { value: "dark", label: t("settings.theme.dark") },
              ]}
            />
          </Field>
        </div>
      </Section>

      <Section title={t("settings.ai")}>
        <p className="muted measure">{t("settings.aiLead")}</p>
        <div className="form-grid">
          <Field label={t("settings.aiProvider")}>
            <Select
              value={s.aiProvider}
              onChange={(e) => settings.set({ aiProvider: e.target.value as AiProvider, aiModel: "" })}
            >
              <option value="auto">{t("settings.aiAuto")}</option>
              {PROVIDER_IDS.map((p) => (
                <option key={p} value={p}>
                  {t(`settings.providers.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          {s.aiProvider !== "auto" && s.aiProvider !== "off" && (
            <>
              <Field label={t("settings.aiKey")} hint={t("settings.aiKeyHint")}>
                <Input
                  type="password"
                  autoComplete="off"
                  value={s.aiKey}
                  onChange={(e) => settings.set({ aiKey: e.target.value.trim() })}
                />
              </Field>
              <Field label={t("settings.aiModel")}>
                <Input
                  value={s.aiModel}
                  placeholder={defaultModel(s.aiProvider)}
                  onChange={(e) => settings.set({ aiModel: e.target.value.trim() })}
                />
              </Field>
            </>
          )}
        </div>
      </Section>

      <Section title={t("settings.data")}>
        {info.data && (
          <Facts
            items={[
              [t("settings.dump"), formatDate(info.data.dump)],
              [t("settings.built"), new Date(info.data.built ?? "").toLocaleString(i18n.resolvedLanguage)],
              [t("settings.size"), formatBytes(info.data.totalBytes)],
              [t("settings.version"), <span className="code" key="v">{info.data.version}</span>],
              [t("settings.stories"), formatNumber(info.data.stats.stories)],
              [t("settings.issues"), formatNumber(info.data.stats.issues)],
            ]}
          />
        )}
        <p className="muted measure">
          <Check size={14} /> {t("settings.dataLead")}{" "}
          <Link className="link" to={routes.about()}>
            {t("nav.about")}
          </Link>
        </p>
      </Section>
    </Page>
  );
}
