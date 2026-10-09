import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { Bird, BookMarked, Dices, FlaskConical, Layers, Library, Orbit, PenLine, Search } from "lucide-react";
import { Page, Section } from "../components/page";
import { StoryShelf } from "../components/stories";
import { Cover } from "../components/ui/Media";
import { Segmented, Select } from "../components/ui/Controls";
import { Skeleton, ErrorState } from "../components/ui/States";
import { Button, ButtonLink } from "../components/ui/Button";
import { anniversary, dbInfo, storyOfTheDay, today } from "../data/home";
import { latestIssues } from "../data/issues";
import { countries } from "../data/publications";
import { randomStory, storyDetail } from "../data/stories";
import { InducksText } from "../components/InducksText";
import { Code } from "../components/ui/Badges";
import { ui } from "../lib/ui";
import { routes } from "../lib/routes";
import { formatDate, formatNumber } from "../lib/format";
import { countryName, rolesLabel } from "../lib/inducks";
import { useHomeCountry } from "../lib/homeCountry";
import { useInView } from "../lib/useInView";
import { settings } from "../lib/store";

/** Exemples de la palette, dans les noms que connaît le lecteur de chaque langue. */
const EXAMPLES: Record<string, string[]> = {
  fr: ["Carl Barks", "Don Rosa", "Picsou Magazine", "Topolino 3000", "Géo Trouvetou"],
  en: ["Carl Barks", "Don Rosa", "Uncle Scrooge", "Gyro Gearloose", "Topolino 3000"],
  de: ["Carl Barks", "Don Rosa", "Lustiges Taschenbuch", "Onkel Dagobert", "Daniel Düsentrieb"],
  it: ["Romano Scarpa", "Giorgio Cavazzano", "Topolino 3000", "Zio Paperone", "Carl Barks"],
  es: ["Carl Barks", "Don Rosa", "Tío Gilito", "Pato Donald", "Topolino 3000"],
  pt: ["Carl Barks", "Don Rosa", "Tio Patinhas", "Pato Donald", "Topolino 3000"],
  nl: ["Carl Barks", "Don Rosa", "Donald Duck", "Oom Dagobert", "Willie Wortel"],
};

function Hero() {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const info = useQuery({ queryKey: ["dbinfo"], queryFn: dbInfo, staleTime: Infinity });
  const country = useHomeCountry();
  const covers = useQuery({
    queryKey: ["latest", country, 18],
    queryFn: () => latestIssues(country, 18),
    staleTime: Infinity,
  });
  const [rolling, setRolling] = useState(false);
  const stats = info.data?.stats;
  const shown = (covers.data ?? []).filter((c) => c.img).slice(0, 5);

  const surprise = async () => {
    setRolling(true);
    try {
      const code = await randomStory();
      if (code) navigate(routes.story(code));
    } finally {
      setRolling(false);
    }
  };

  return (
    <section className="hero">
      <div className="hero__text">
        <h1 className="hero__title">{t("home.title")}</h1>
        <p className="hero__lead">
          {stats
            ? t("home.lead", {
                stories: formatNumber(stats.stories),
                issues: formatNumber(stats.issues),
                creators: formatNumber(stats.creators),
              })
            : t("home.leadLoading")}
        </p>
        <button className="hero__search" onClick={() => ui.openPalette()}>
          <Search size={20} />
          <span>{t("home.searchPlaceholder")}</span>
        </button>
        <div className="hero__examples">
          <span className="muted">{t("home.try")}</span>
          {(EXAMPLES[(i18n.resolvedLanguage || "en").split("-")[0]] ?? EXAMPLES.en).map((ex) => (
            <button key={ex} className="example" onClick={() => ui.openPalette(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <div className="hero__actions">
          <Button variant="primary" icon={<Search size={17} />} onClick={() => navigate(routes.search())}>
            {t("home.advanced")}
          </Button>
          <Button icon={<Dices size={17} />} onClick={surprise} disabled={rolling}>
            {t("home.random")}
          </Button>
        </div>
      </div>
      <div className="hero__covers" aria-hidden>
        {shown.length === 0 && covers.isLoading && (
          <div className="hero__fan">
            {[0, 1, 2].map((i) => (
              <div className="hero__fan-item" key={i} style={{ ["--i" as string]: i - 1 }}>
                <Skeleton w="100%" h="100%" r={3} />
              </div>
            ))}
          </div>
        )}
        {shown.length > 0 && (
          <div className="hero__fan">
            {shown.map((c, i) => {
              const offset = i - (shown.length - 1) / 2;
              return (
                <motion.div
                  key={c.issuecode}
                  className="hero__fan-item"
                  style={{ ["--i" as string]: offset, zIndex: 10 - Math.abs(Math.round(offset)) }}
                  initial={reduce ? false : { opacity: 0, y: 40, rotate: 0 }}
                  animate={{ opacity: 1, y: 0, rotate: offset * 6 }}
                  transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.08 * i }}
                >
                  <Link to={routes.issue(c.issuecode, c.publicationcode)} tabIndex={-1}>
                    <Cover img={c.img} alt="" quality="medium" seed={c.issuecode} eager />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
        {shown.length > 0 && (
          <p className="hero__caption">
            {t("home.coversCaption", { country: countryName(country) })}
          </p>
        )}
      </div>
    </section>
  );
}

/** L'histoire du jour : une grande histoire tirée chaque jour, avec sa première page. */
function Daily() {
  const { t, i18n } = useTranslation();
  const day = today();
  const code = useQuery({ queryKey: ["daily", day], queryFn: () => storyOfTheDay(day), staleTime: Infinity });
  const story = useQuery({
    queryKey: ["story", code.data, i18n.resolvedLanguage],
    queryFn: () => storyDetail(code.data as string),
    enabled: !!code.data,
    staleTime: Infinity,
  });
  const s = story.data;
  if (code.isError || story.isError || code.data === null) return null;
  const lang = (i18n.resolvedLanguage || "en").split("-")[0];
  const desc = s ? (s.descriptions.find((d) => d.lang === lang) ?? s.descriptions.find((d) => d.lang === "en")) : undefined;
  return (
    <Section id="daily" title={t("home.daily")} aside={<span className="muted">{formatDate(day)}</span>}>
      {!s ? (
        <div className="daily">
          <Skeleton w="100%" h={240} />
          <div className="daily__text">
            <Skeleton w="60%" h={28} />
            <Skeleton w="40%" h={16} />
            <Skeleton w="100%" h={90} />
          </div>
        </div>
      ) : (
        <article className="daily">
          <Link to={routes.story(s.storycode)} className="daily__cover" tabIndex={-1} aria-hidden>
            <Cover img={s.img} alt="" quality="medium" seed={s.storycode} />
          </Link>
          <div className="daily__text">
            <p className="daily__meta">
              <Code>{s.storycode}</Code>
              {s.date && <span>{s.date.slice(0, 4)}</span>}
              {s.pages && <span>{t("story.pagesN", { n: s.pages })}</span>}
            </p>
            <h3 className="daily__title">
              <Link to={routes.story(s.storycode)}>{s.title || s.storycode}</Link>
            </h3>
            {s.original && <p className="daily__original">{s.original}</p>}
            {s.people.length > 0 && (
              <p className="daily__credits">
                {s.people.slice(0, 3).map((p, i) => (
                  <span key={p.code}>
                    {i > 0 && ", "}
                    <Link className="person-link" to={routes.creator(p.code)}>
                      {p.name}
                    </Link>
                    <span className="muted"> ({rolesLabel(p.roles).toLowerCase()})</span>
                  </span>
                ))}
              </p>
            )}
            {desc && <InducksText text={desc.text} className="daily__desc" />}
            <div>
              <ButtonLink to={routes.story(s.storycode)} variant="secondary">
                {t("home.dailyOpen")}
              </ButtonLink>
            </div>
          </div>
        </article>
      )}
    </Section>
  );
}

function Latest() {
  const { t } = useTranslation();
  const country = useHomeCountry();
  const list = useQuery({
    queryKey: ["latest", country, 18],
    queryFn: () => latestIssues(country, 18),
    staleTime: Infinity,
  });
  const all = useQuery({ queryKey: ["countries"], queryFn: countries, staleTime: Infinity });
  const options = useMemo(
    () =>
      (all.data ?? [])
        .map((c) => ({ code: c.code, name: countryName(c.code, c.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [all.data],
  );
  return (
    <Section
      id="latest"
      title={t("home.latest")}
      aside={
        <Select
          aria-label={t("home.country")}
          value={country}
          onChange={(e) => settings.set({ country: e.target.value })}
        >
          {!options.some((o) => o.code === country) && <option value={country}>{countryName(country)}</option>}
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </Select>
      }
    >
      {list.isError && <ErrorState error={list.error} retry={() => list.refetch()} />}
      <div className="issue-shelf">
        {(list.data ?? Array.from({ length: 8 }, () => null)).map((it, i) =>
          it ? (
            <Link key={it.issuecode} to={routes.issue(it.issuecode, it.publicationcode)} className="issue-tile">
              <Cover img={it.img} alt="" seed={it.issuecode} />
              <span className="issue-tile__title">
                {it.publicationTitle} <span className="num">{it.number}</span>
              </span>
              <span className="issue-tile__date">{formatDate(it.date, "short")}</span>
            </Link>
          ) : (
            <div className="issue-tile" key={i}>
              <Skeleton w="100%" h={190} r={3} />
              <Skeleton w="80%" h={12} />
            </div>
          ),
        )}
      </div>
    </Section>
  );
}

function Anniversary() {
  const { t } = useTranslation();
  const [years, setYears] = useState<"25" | "50" | "75">("75");
  // Section du bas de page : interrogée seulement quand on s'en approche.
  const [ref, inView] = useInView<HTMLDivElement>();
  const data = useQuery({
    queryKey: ["anniversary", years],
    queryFn: () => anniversary(Number(years), 10),
    staleTime: Infinity,
    enabled: inView,
  });
  const month = new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date());
  return (
    <Section
      id="anniversary"
      title={t("home.anniversary", { years, month })}
      aside={
        <Segmented
          label={t("home.anniversaryChoice")}
          value={years}
          onChange={setYears}
          items={[
            { value: "25", label: t("home.yearsAgo", { n: 25 }) },
            { value: "50", label: t("home.yearsAgo", { n: 50 }) },
            { value: "75", label: t("home.yearsAgo", { n: 75 }) },
          ]}
        />
      }
    >
      <div ref={ref}>
        {data.data && data.data.sids.length === 0 ? (
          <p className="muted">{t("home.anniversaryNone")}</p>
        ) : (
          <StoryShelf sids={data.data?.sids ?? []} />
        )}
      </div>
    </Section>
  );
}

function ExploreList() {
  const { t } = useTranslation();
  const info = useQuery({ queryKey: ["dbinfo"], queryFn: dbInfo, staleTime: Infinity });
  const s = info.data?.stats;
  const items = [
    { to: routes.countries(), icon: Library, key: "publications", n: s ? t("home.n.publications", { n: formatNumber(s.publications), c: formatNumber(s.countries) }) : "" },
    { to: routes.creators(), icon: PenLine, key: "creators", n: s ? t("home.n.creators", { n: formatNumber(s.creators) }) : "" },
    { to: routes.characters(), icon: Bird, key: "characters", n: s ? t("home.n.characters", { n: formatNumber(s.characters) }) : "" },
    { to: routes.universes(), icon: Orbit, key: "universes", n: t("nav.hint.universes") },
    { to: routes.subseriesList(), icon: Layers, key: "series", n: t("nav.hint.series") },
    { to: routes.collection(), icon: BookMarked, key: "collection", n: t("nav.hint.collection") },
    { to: routes.lab(), icon: FlaskConical, key: "lab", n: t("nav.hint.lab") },
  ];
  return (
    <Section id="explore" title={t("home.explore")}>
      <ul className="explore-list">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.key}>
              <Link to={it.to}>
                <span className="explore-list__icon">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span>
                  <strong>{t(`nav.${it.key}`)}</strong>
                  <small>{it.n}</small>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export default function Home() {
  return (
    <Page>
      <Hero />
      <Daily />
      <Latest />
      <Anniversary />
      <ExploreList />
    </Page>
  );
}
