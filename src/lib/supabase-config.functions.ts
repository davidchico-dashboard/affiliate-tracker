import { createServerFn } from "@tanstack/react-start";

/**
 * Public Supabase configuration surfaced to the browser through a trusted
 * server function.
 *
 * - Reads ONLY the publishable Supabase values from the server environment:
 *   SUPABASE_URL and SUPABASE_ANON_KEY.
 * - Returns exactly those two values to the client so it can initialize the
 *   browser Supabase client. The anon/public key is designed for browser use;
 *   security is enforced by Row Level Security in the database.
 * - NEVER returns, references, logs, or exposes SUPABASE_SERVICE_ROLE_KEY. The
 *   service-role key is intentionally not read anywhere in this module.
 *
 * The server function is a thin wrapper: it reads `process.env` inside the
 * handler (env injection happens at call time) and returns a plain DTO.
 */

export interface PublicSupabaseConfig {
  url: string | null;
  anonKey: string | null;
  configured: boolean;
}

export const getPublicSupabaseConfig = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"] ?? null;
  const anonKey = process.env["SUPABASE_ANON_KEY"] ?? null;
  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  };
});
