export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || ""

export function getApiUrl(path: string) {
  const cleaned = path.replace(/^\//, "")
  if (API_BASE_URL) {
    return `${API_BASE_URL}/${cleaned}`
  }
  return `/${cleaned}`
}

export async function fetchJson<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(getApiUrl(path), options)
  if (!res.ok) {
    const errorMessage = await res.text()
    throw new Error(errorMessage || `Request failed with status ${res.status}`)
  }
  return res.json()
}
