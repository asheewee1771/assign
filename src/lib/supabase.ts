import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Give up on a request rather than leaving the UI on "Loading…" forever. */
const REQUEST_TIMEOUT_MS = 15_000

/**
 * False until .env is filled in. The app renders setup instructions in that
 * case rather than crashing on a null client, so a fresh clone still runs.
 *
 * The anon key is public by design — it ships inside this page. Every write is
 * gated by row level security and the SECURITY DEFINER functions in
 * supabase/schema.sql, so a reader of this key cannot modify anything directly.
 */
export const isConfigured = Boolean(url && anonKey)

/**
 * A wrong URL or a dropped connection otherwise hangs indefinitely: the promise
 * never settles, so no catch and no finally ever runs.
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Respect a caller-supplied signal instead of overriding it.
  if (init?.signal) return fetch(input, init)
  return fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
}

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, anonKey as string, {
      global: { fetch: fetchWithTimeout },
    })
  : null

/** Narrow the nullable client at the point of use. */
export function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured — see README')
  return supabase
}
