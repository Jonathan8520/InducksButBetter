import { Component, lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ErrorState, Skeleton } from "./components/ui/States";
import Home from "./pages/Home";

/**
 * Après une mise en ligne, une page restée ouverte réclame d'anciens fichiers de code qui
 * n'existent plus. On recharge alors la page une fois (pas plus d'une fois par minute).
 */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem("ibb.reloaded") ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem("ibb.reloaded", String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnce()) event.preventDefault();
  });
}

function page<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((err: unknown) => {
      if (reloadOnce()) return new Promise<{ default: T }>(() => {});
      throw err;
    }),
  );
}

/** Une erreur de rendu reste dans la page : le menu et la recherche restent utilisables. */
class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <ErrorState error={this.state.error} retry={() => window.location.reload()} />
        </div>
      );
    }
    return this.props.children;
  }
}

const Search = page(() => import("./pages/Search"));
const Story = page(() => import("./pages/Story"));
const Issue = page(() => import("./pages/Issue"));
const Publication = page(() => import("./pages/Publication"));
const Countries = page(() => import("./pages/Countries").then((m) => ({ default: m.Countries })));
const Country = page(() => import("./pages/Countries").then((m) => ({ default: m.Country })));
const Creators = page(() => import("./pages/Creators").then((m) => ({ default: m.Creators })));
const Creator = page(() => import("./pages/Creators").then((m) => ({ default: m.Creator })));
const Characters = page(() => import("./pages/Characters").then((m) => ({ default: m.Characters })));
const Character = page(() => import("./pages/Characters").then((m) => ({ default: m.Character })));
const Universes = page(() => import("./pages/Characters").then((m) => ({ default: m.Universes })));
const Universe = page(() => import("./pages/Characters").then((m) => ({ default: m.Universe })));
const SeriesList = page(() => import("./pages/Series").then((m) => ({ default: m.SeriesList })));
const Series = page(() => import("./pages/Series").then((m) => ({ default: m.Series })));
const Publisher = page(() => import("./pages/Series").then((m) => ({ default: m.Publisher })));
const Collection = page(() => import("./pages/Collection"));
const Lab = page(() => import("./pages/Lab"));
const Settings = page(() => import("./pages/Settings"));
const About = page(() => import("./pages/About"));
const NotFoundPage = page(() => import("./pages/About").then((m) => ({ default: m.NotFoundPage })));

/** Adresses « parentes » tapées à la main : on renvoie vers la page qui existe. */
function ToCountry() {
  const { country } = useParams();
  return <Navigate to={country ? `/countries/${country}` : "/countries"} replace />;
}

function Fallback() {
  return (
    <div className="page" aria-busy="true">
      <Skeleton w="40%" h={36} />
      <Skeleton w="70%" h={16} />
      <Skeleton w="100%" h={240} />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  return (
    <AppShell>
      <Boundary key={location.pathname}>
        <Suspense fallback={<Fallback />}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/stories/:code" element={<Story />} />
            <Route path="/issues/:country/:pub/:number" element={<Issue />} />
            <Route path="/issues/:country/:pub/" element={<Issue />} />
            <Route path="/publications/:country/:pub" element={<Publication />} />
            <Route path="/publications/:country" element={<ToCountry />} />
            <Route path="/publications" element={<ToCountry />} />
            <Route path="/issues/:country" element={<ToCountry />} />
            <Route path="/issues" element={<ToCountry />} />
            <Route path="/stories" element={<Navigate to="/search" replace />} />
            <Route path="/countries" element={<Countries />} />
            <Route path="/countries/:code" element={<Country />} />
            <Route path="/creators" element={<Creators />} />
            <Route path="/creators/:code" element={<Creator />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/characters/:code" element={<Character />} />
            <Route path="/universes" element={<Universes />} />
            <Route path="/universes/:code" element={<Universe />} />
            <Route path="/series" element={<SeriesList />} />
            <Route path="/series/:code" element={<Series />} />
            <Route path="/publishers/:id" element={<Publisher />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/lab" element={<Lab />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Boundary>
    </AppShell>
  );
}
