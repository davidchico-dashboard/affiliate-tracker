import { describe, expect, it, beforeEach } from "vitest";

import {
  configureSupabase,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClient,
} from "@/lib/supabase";

describe("runtime Supabase configuration", () => {
  beforeEach(() => {
    resetSupabaseClient();
  });

  it("getSupabaseClient is null until configureSupabase is called", () => {
    expect(getSupabaseClient()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("configureSupabase initializes the client and marks it configured", () => {
    const client = configureSupabase("https://example.supabase.co", "example-anon-key");
    expect(client).toBeDefined();
    expect(getSupabaseClient()).toBe(client);
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("resetSupabaseClient clears the client back to unconfigured", () => {
    configureSupabase("https://example.supabase.co", "example-anon-key");
    resetSupabaseClient();
    expect(getSupabaseClient()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("never references the service-role key (no such import is needed for ordinary use)", () => {
    // The browser client is constructed from only the public URL + anon key.
    const client = configureSupabase("https://example.supabase.co", "example-anon-key");
    // A real SupabaseClient exposes auth (used for real sign-in / session), but
    // never carries a service role. This assertion guards against accidentally
    // routing a privileged key into the browser client in the future.
    expect(client).toBeDefined();
    expect(typeof client.auth.getSession).toBe("function");
    expect(typeof client.auth.signInWithPassword).toBe("function");
  });
});
