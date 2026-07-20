import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFlagUrl(countryCode: string): string {
  if (!countryCode) return "";
  let code = countryCode.toLowerCase().trim();
  const map: Record<string, string> = {
    uk: "gb",
    en: "gb",
    sf: "fi",
  };
  code = map[code] || code;
  return `https://flagcdn.com/w20/${code}.png`;
}

