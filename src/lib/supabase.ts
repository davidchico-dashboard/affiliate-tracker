import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client initialized from runtime configuration returned by
 * the trusted `getPublicSupabaseConfig` server function.
 *
 * Why runtime config instead of `import.meta.env.VITE_*`:
 *   This deployment platform does not permit `VITE_`-prefixed secrets, and the
 *   Supabase values are stored as unprefixed server env vars (`SUPABASE_URL`,
 *   `SUPABASE_ANON_KEY`). They are read on the server and passed to the browser
 *   as a plain DTO. Only the publishable URL + anon/public key ever reach the
 *   client. The service-role key is NEVER imported, read, or exposed here.
 *
 * Security:
 *   - The anon key is public by design and safe in the browser bundle. All data
 *     access is enforced by Row Level Security in the database.
 *   - `SUPABASE_SERVICE_ROLE_KEY` is never referenced in this module. If it is
 *     ever needed it must be read only inside trusted server-side code.
 *
 * Lifecycle:
 *   - The client is created lazily once `configureSupabase()` is called with
 *     values from the server function. Until then `getSupabaseClient()` returns
 *     `null`, which the auth layer treats as a loading/config-pending state.
 *   - `isSupabaseConfigured` is updated after a successful configuration call.
 */

export const supabaseConfigError: string | null =
  "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (server environment) before this application can sign users in or read data.";

let client: SupabaseClient | null = null;
let configured = false;

/**
 * Initialize (or reinitialize) the browser Supabase client from the public
 * configuration returned by the server function. Safe to call once on app boot
 * and again if the configuration is ever refreshed.
 */
export function configureSupabase(url: string, anonKey: string): SupabaseClient {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  configured = true;
  return client;
}

/** The configured browser Supabase client, or `null` until runtime config arrives. */
export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

/** True once `configureSupabase()` has been called with valid public values. */
export function isSupabaseConfigured(): boolean {
  return configured;
}

/** Reset the client back to unconfigured (used by tests / sign-out edge cases). */
export function resetSupabaseClient(): void {
  client = null;
  configured = false;
}
