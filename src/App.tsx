import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Skeleton } from "./components/ui/States";
import Home from "./pages/Home";

const Search = lazy(() => import("./pages/Search"));
const Story = lazy(() => import("./pages/Story"));
const Issue = lazy(() => import("./pages/Issue"));
const Publication = lazy(() => import("./pages/Publication"));
const Countries = lazy(() => import("./pages/Countries").then((m) => ({ default: m.Countries })));
const Country = lazy(() => import("./pages/Countries").then((m) => ({ default: m.Country })));
const Creators = lazy(() => import("./pages/Creators").then((m) => ({ default: m.Creators })));
const Creator = lazy(() => import("./pages/Creators").then((m) => ({ default: m.Creator })));
const Characters = lazy(() => import("./pages/Characters").then((m) => ({ default: m.Characters })));
const Character = lazy(() => import("./pages/Characters").then((m) => ({ default: m.Character })));
const Universes = lazy(() => import("./pages/Characters").then((m) => ({ default: m.Universes })));
const Universe = lazy(() => import("./pages/Characters").then((m) => ({ default: m.Universe })));
const SeriesList = lazy(() => import("./pages/Series").then((m) => ({ default: m.SeriesList })));
const Series = lazy(() => import("./pages/Series").then((m) => ({ default: m.Series })));
const Publisher = lazy(() => import("./pages/Series").then((m) => ({ default: m.Publisher })));
const Collection = lazy(() => import("./pages/Collection"));
const Lab = lazy(() => import("./pages/Lab"));
const Settings = lazy(() => import("./pages/Settings"));
const About = lazy(() => import("./pages/About"));
const NotFoundPage = lazy(() => import("./pages/About").then((m) => ({ default: m.NotFoundPage })));

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
      <Suspense fallback={<Fallback />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/stories/:code" element={<Story />} />
          <Route path="/issues/:country/:pub/:number" element={<Issue />} />
          <Route path="/issues/:country/:pub/" element={<Issue />} />
          <Route path="/publications/:country/:pub" element={<Publication />} />
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
    </AppShell>
  );
}
