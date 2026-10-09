import {
  Bird,
  BookMarked,
  FlaskConical,
  House,
  Info,
  Layers,
  Library,
  Orbit,
  PenLine,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { routes } from "../../lib/routes";

export interface NavItem {
  key: string;
  to: string;
  icon: LucideIcon;
  /** Préfixes d'URL qui rendent l'entrée active. */
  match: string[];
}

export const PRIMARY: NavItem[] = [
  { key: "home", to: routes.home(), icon: House, match: [] },
  { key: "search", to: routes.search(), icon: Search, match: ["/search", "/stories"] },
  { key: "publications", to: routes.countries(), icon: Library, match: ["/countries", "/publications", "/issues", "/publishers"] },
  { key: "creators", to: routes.creators(), icon: PenLine, match: ["/creators"] },
  { key: "characters", to: routes.characters(), icon: Bird, match: ["/characters"] },
  { key: "universes", to: routes.universes(), icon: Orbit, match: ["/universes"] },
  { key: "series", to: routes.subseriesList(), icon: Layers, match: ["/series"] },
];

export const SECONDARY: NavItem[] = [
  { key: "collection", to: routes.collection(), icon: BookMarked, match: ["/collection"] },
  { key: "lab", to: routes.lab(), icon: FlaskConical, match: ["/lab"] },
];

export const FOOTER: NavItem[] = [
  { key: "settings", to: routes.settings(), icon: Settings, match: ["/settings"] },
  { key: "about", to: routes.about(), icon: Info, match: ["/about"] },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}
