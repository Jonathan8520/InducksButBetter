import { tursoClient } from "./turso"
import { executeLocal, hasLocalDb } from "./localDb"

/**
 * Unifies the execution of SQL queries:
 * If a local database is loaded, it executes queries locally in-memory.
 * Otherwise, it defaults to the Turso remote client.
 */
export async function executeQuery(query: { sql: string, args?: any[] } | string, onRow?: (row: any) => void) {
  if (hasLocalDb()) {
    return executeLocal(query, onRow)
  }
  if (typeof query === 'string') {
    return tursoClient.execute(query)
  }
  return tursoClient.execute({ sql: query.sql, args: query.args || [] })
}
