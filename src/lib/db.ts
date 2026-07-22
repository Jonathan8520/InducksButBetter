import { tursoClient } from "./turso"
import { executeLocal, hasLocalDb } from "./localDb"
import { openRemoteDb, executeRemote } from "./sqlite/client"

/**
 * Point de bascule du moteur de base de données. Trois chemins, une seule interface :
 *
 *  1. base locale importée par l'utilisateur (fichiers ISV) — prioritaire s'il y en a une
 *  2. base statique distante, lue par requêtes HTTP Range (le mode par défaut)
 *  3. Turso — chemin historique, conservé en repli tant que la migration n'est pas finie
 *
 * Les appelants ne voient qu'un `{ rows }` : c'est cette indirection qui a permis de
 * changer de moteur sans toucher aux composants.
 */

/**
 * Emplacement des tranches de base et de leur manifeste.
 * Vide (ou absent) => on retombe sur Turso, ce qui laisse l'ancien déploiement fonctionnel.
 */
const STATIC_DB_URL: string = (() => {
  const configured = import.meta.env.VITE_STATIC_DB_URL
  if (configured === "" || configured === "off") return ""
  if (configured) return configured
  // Par défaut : à côté du site, tel que publié par scripts/split_db.py.
  const base = import.meta.env.BASE_URL || "/"
  return `${base.endsWith("/") ? base : base + "/"}db/`
})()

export function usesStaticDb(): boolean {
  return STATIC_DB_URL !== ""
}

export function staticDbUrl(): string {
  return STATIC_DB_URL
}

export async function executeQuery(
  query: { sql: string; args?: any[] } | string,
  onRow?: (row: any) => void,
) {
  if (hasLocalDb()) {
    return executeLocal(query, onRow)
  }

  if (STATIC_DB_URL) {
    await openRemoteDb(STATIC_DB_URL)
    return executeRemote(query as any, onRow)
  }

  if (typeof query === "string") {
    return tursoClient.execute(query)
  }
  return tursoClient.execute({ sql: query.sql, args: query.args || [] })
}
