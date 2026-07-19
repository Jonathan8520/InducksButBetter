import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { tursoClient } from "@/lib/turso";
import { COMMON_LANGUAGES } from "@/lib/constants";
import { MetaData } from "@/lib/types";

export function useMetadata() {
  const { i18n } = useTranslation();
  const [meta, setMeta] = useState<MetaData>({
    languages: [],
    kinds: [],
    countries: [],
    universes: [],
    subseries: [],
  });
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    const currentLang = i18n.language || "fr";
    const loadMeta = async () => {
      setLoadingMeta(true);
      const cacheKey = `inducks_meta_${currentLang}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setMeta(JSON.parse(cached));
        setLoadingMeta(false);
        return;
      }

      try {
        const [kindsRes, countriesRes, universesRes, subseriesRes] = await Promise.all([
          tursoClient.execute("SELECT DISTINCT kind FROM inducks_storyversion WHERE kind IS NOT NULL"),
          tursoClient.execute({
            sql: "SELECT c.countrycode, COALESCE(cn.countryname, c.countryname) as countryname FROM inducks_country c LEFT JOIN inducks_countryname cn ON c.countrycode = cn.countrycode AND cn.languagecode = ? ORDER BY countryname",
            args: [currentLang],
          }),
          tursoClient.execute("SELECT universecode, universecomment as universename FROM inducks_universe ORDER BY universecomment"),
          tursoClient.execute({
            sql: "SELECT subseriescode, subseriesname as label FROM inducks_subseriesname WHERE languagecode = ? OR languagecode = 'en' GROUP BY subseriescode ORDER BY CASE WHEN languagecode = ? THEN 0 ELSE 1 END, subseriesname",
            args: [currentLang, currentLang],
          }),
        ]);

        const metaObj: MetaData = {
          languages: COMMON_LANGUAGES.map((l) => ({ languagecode: l.code, languagename: l.label })),
          kinds: kindsRes.rows.map((r: any) => String(r.kind)),
          countries: countriesRes.rows.map((r: any) => ({ countrycode: String(r.countrycode), countryname: String(r.countryname) })),
          universes: universesRes.rows.map((r: any) => ({ universecode: String(r.universecode), universename: String(r.universename) })),
          subseries: subseriesRes.rows.map((r: any) => ({ value: String(r.subseriescode), label: String(r.label), group: "Series" })),
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(metaObj));
        setMeta(metaObj);
      } catch (err) {
        console.error("Failed to load meta from Turso:", err);
        setMeta({
          languages: COMMON_LANGUAGES.map((l) => ({ languagecode: l.code, languagename: l.label })),
          kinds: [],
          countries: [],
          universes: [],
          subseries: [],
        });
      } finally {
        setLoadingMeta(false);
      }
    };
    loadMeta();
  }, [i18n.language]);

  return { meta, loadingMeta };
}
