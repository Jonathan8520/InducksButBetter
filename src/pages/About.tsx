import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHead, Section } from "../components/page";
import { Empty } from "../components/ui/States";
import { ButtonLink } from "../components/ui/Button";
import { dbInfo } from "../data/home";
import { formatBytes, formatDate } from "../lib/format";
import { routes } from "../lib/routes";
import { sessionIo } from "../db/client";

export default function About() {
  const { t } = useTranslation();
  const info = useQuery({ queryKey: ["dbinfo"], queryFn: dbInfo, staleTime: Infinity });
  return (
    <Page title={t("about.title")}>
      <PageHead title={t("about.title")} lead={t("about.lead")} />
      <div className="prose measure about">
        <Section title={t("about.howTitle")}>
          <p>{t("about.how1")}</p>
          <p>
            {t("about.how2", {
              size: info.data ? formatBytes(info.data.totalBytes) : "…",
              session: formatBytes(sessionIo.bytes),
            })}
          </p>
          <p>{t("about.how3", { date: info.data ? formatDate(info.data.dump ?? info.data.built) : "…" })}</p>
        </Section>
        <Section title={t("about.dataTitle")}>
          <p>
            {t("about.data1")}{" "}
            <a href="https://inducks.org" target="_blank" rel="noreferrer">
              inducks.org
            </a>
            . {t("about.data2")}
          </p>
          <p>{t("about.data3")}</p>
        </Section>
        <Section title={t("about.creditsTitle")}>
          <p>
            {t("about.credits1")}{" "}
            <a href="https://github.com/WizyxGH/InducksButBetter" target="_blank" rel="noreferrer">
              WizyxGH/InducksButBetter
            </a>
            . {t("about.credits2")}
          </p>
          <p>
            {t("about.source")}{" "}
            <a href="https://github.com/Jonathan8520/InducksButBetter" target="_blank" rel="noreferrer">
              github.com/Jonathan8520/InducksButBetter
            </a>
            .
          </p>
        </Section>
        <Section title={t("about.disclaimerTitle")}>
          <p>{t("about.disclaimer")}</p>
        </Section>
      </div>
    </Page>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Page title={t("errors.pageNotFound")}>
      <Empty
        title={t("errors.pageNotFound")}
        action={
          <ButtonLink to={routes.home()} variant="primary">
            {t("nav.home")}
          </ButtonLink>
        }
      >
        {t("errors.pageNotFoundBody")} <Link className="link" to={routes.search()}>{t("nav.search")}</Link>
      </Empty>
    </Page>
  );
}
