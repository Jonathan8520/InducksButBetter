import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { executeQuery } from "@/lib/db";
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
          // meta_kind est figée au build : dix lignes.
          // La forme précédente, `SELECT DISTINCT kind FROM inducks_storyversion`, parcourait
          // les 734 876 versions pour trouver ces dix valeurs — mesuré à 23 107 pages,
          // 90,3 Mo et 1 249 requêtes HTTP, à chaque montage du formulaire de recherche.
          executeQuery("SELECT kind FROM meta_kind ORDER BY kind").catch(() =>
            // Repli pour une base importée localement, où la table n'existe pas.
            executeQuery("SELECT DISTINCT kind FROM inducks_storyversion WHERE kind IS NOT NULL")
          ),
          executeQuery({
            sql: "SELECT c.countrycode, COALESCE(cn.countryname, c.countryname) as countryname FROM inducks_country c LEFT JOIN inducks_countryname cn ON c.countrycode = cn.countrycode AND cn.languagecode = ? ORDER BY countryname",
            args: [currentLang],
          }),
          executeQuery("SELECT universecode, universecomment as universename FROM inducks_universe ORDER BY universecomment"),
          executeQuery({
            sql: "SELECT subseriescode, subseriesname as label FROM inducks_subseriesname WHERE languagecode = ? OR languagecode = 'en' GROUP BY subseriescode ORDER BY CASE WHEN languagecode = ? THEN 0 ELSE 1 END, subseriesname",
            args: [currentLang, currentLang],
          }),
        ]);

        const metaObj: MetaData = {
          languages: COMMON_LANGUAGES.map((l) => ({ languagecode: l.code, languagename: l.label })),
          kinds: kindsRes.rows.map((r: any) => String(r.kind)),
          countries: countriesRes.rows
            .map((r: any) => ({ countrycode: String(r.countrycode), countryname: String(r.countryname) }))
            .sort((a: any, b: any) => a.countryname.localeCompare(b.countryname, currentLang)),
          universes: universesRes.rows
            .map((r: any) => ({ universecode: String(r.universecode), universename: String(r.universename) }))
            .sort((a: any, b: any) => a.universename.localeCompare(b.universename, currentLang)),
          subseries: subseriesRes.rows
            .map((r: any) => ({ value: String(r.subseriescode), label: String(r.label), group: "Series" }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label, currentLang)),
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
