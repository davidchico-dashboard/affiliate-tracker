import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";

import {
  configureSupabase,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClient,
  supabaseConfigError,
} from "./supabase";
import { getPublicSupabaseConfig } from "./supabase-config.functions";
import type { AuthStatus, SystemRole, SystemUser } from "./types";
import { resolveBranding } from "./branding";
import type { PlatformSettings } from "./types";

interface AuthContextValue {
  status: AuthStatus;
  configError: string | null;
  session: Session | null;
  user: SystemUser | null;
  role: SystemRole | null;
  branding: PlatformSettings;
  brandingLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshBranding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // status starts as "loading" while the public Supabase config is fetched from
  // the server. If the server reports the values are missing (or the call
  // fails), status becomes "config-missing"; otherwise the normal auth flow
  // proceeds. Every async step is guarded so a failure can never throw out of
  // the effect and crash the root error boundary.
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SystemUser | null>(null);
  const [branding, setBranding] = useState<PlatformSettings>(() => resolveBranding(null));
  const [brandingLoading, setBrandingLoading] = useState(true);

  const fetchConfig = useServerFn(getPublicSupabaseConfig);

  // Keep the latest auth subscription so we can tear it down when the client is
  // reconfigured. Using a ref avoids re-running the boot effect on every
  // status change.
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  const loadSystemUser = useCallback(async (activeSession: Session): Promise<SystemUser | null> => {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const authId = activeSession.user?.id;
    if (!authId) return null;
    const { data, error } = await sb
      .from("system_users")
      .select("id,auth_id,email,full_name,role,status,avatar_url,created_at,updated_at")
      .eq("auth_id", authId)
      .maybeSingle();
    if (error) {
      // Expected before the migration is applied (table missing) or when RLS
      // blocks the read. Never throw — degrade to an unauthenticated shell so
      // the app keeps rendering instead of crashing the boundary.
      console.error("Failed to load system user", error.message);
      return null;
    }
    return (data as SystemUser | null) ?? null;
  }, []);

  const refresh = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) return;
    try {
      const { data } = await sb.auth.getSession();
      const activeSession = data.session;
      setSession(activeSession);
      if (activeSession) {
        const profile = await loadSystemUser(activeSession);
        setUser(profile);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch (err) {
      console.error("Failed to refresh session", err);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [loadSystemUser]);

  const loadBranding = useCallback(async () => {
    setBrandingLoading(true);
    const sb = getSupabaseClient();
    if (!sb) {
      setBranding(resolveBranding(null));
      setBrandingLoading(false);
      return;
    }
    try {
      const { data, error } = await sb
        .from("platform_settings")
        .select(
          "id,platform_name,company_name,logo_url,favicon_url,primary_color,accent_color,login_heading,login_subheading,support_email,default_timezone,affiliate_term,user_term",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        // Expected before the migration is applied. Fall back to defaults so the
        // login page still renders.
        console.error("Failed to load platform settings", error.message);
        setBranding(resolveBranding(null));
      } else {
        setBranding(resolveBranding((data as Partial<PlatformSettings> | null) ?? null));
      }
    } catch (err) {
      console.error("Failed to load platform settings", err);
      setBranding(resolveBranding(null));
    } finally {
      setBrandingLoading(false);
    }
  }, []);

  const refreshBranding = useCallback(async () => {
    await loadBranding();
  }, [loadBranding]);

  // Boot: fetch the public Supabase config from the trusted server function,
  // initialize the browser client, then run the normal auth + branding flow.
  // The entire flow is wrapped so no rejection can escape into the React
  // render/error boundary. The client is only read AFTER configureSupabase()
  // resolves, and the auth subscription is attached inside the same async
  // block once the client exists.
  useEffect(() => {
    let mounted = true;

    void (async () => {
      let cfg;
      try {
        cfg = await fetchConfig();
      } catch (err) {
        // Server function failure (e.g. during SSR prerender without env, or a
        // network/RPC error). Degrade to the config-missing shell rather than
        // crashing.
        if (!mounted) return;
        console.error("Failed to load Supabase configuration", err);
        setStatus("config-missing");
        setBrandingLoading(false);
        return;
      }
      if (!mounted) return;

      if (!cfg.configured || !cfg.url || !cfg.anonKey) {
        setStatus("config-missing");
        setBrandingLoading(false);
        return;
      }

      // Initialize the browser client with the public values returned by the
      // server. Only the URL + anon key are used; no service-role key is ever
      // present in this code path.
      configureSupabase(cfg.url, cfg.anonKey);

      // Kick off branding load (non-blocking; failures are swallowed inside).
      void loadBranding();

      const sb = getSupabaseClient();
      if (!sb) {
        setStatus("unauthenticated");
        return;
      }

      // Attach the auth state listener now that the client exists. Tear down
      // any previous subscription first.
      if (subRef.current) {
        try {
          subRef.current.unsubscribe();
        } catch {
          /* ignore */
        }
      }
      try {
        const { data: subData } = sb.auth.onAuthStateChange(async (_event, newSession) => {
          if (!mounted) return;
          setSession(newSession);
          if (newSession) {
            try {
              const profile = await loadSystemUser(newSession);
              if (!mounted) return;
              setUser(profile);
              setStatus("authenticated");
            } catch (err) {
              console.error("Auth state change profile load failed", err);
              setUser(null);
              setStatus("unauthenticated");
            }
          } else {
            setUser(null);
            setStatus("unauthenticated");
          }
        });
        subRef.current = subData.subscription;
      } catch (err) {
        console.error("Failed to attach auth state listener", err);
      }

      // Resolve the current session.
      try {
        const { data } = await sb.auth.getSession();
        if (!mounted) return;
        const activeSession = data.session;
        setSession(activeSession);
        if (activeSession) {
          const profile = await loadSystemUser(activeSession);
          if (!mounted) return;
          setUser(profile);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      } catch (err) {
        console.error("Failed to resolve session", err);
        setUser(null);
        setStatus("unauthenticated");
      }
    })();

    return () => {
      mounted = false;
      if (subRef.current) {
        try {
          subRef.current.unsubscribe();
        } catch {
          /* ignore */
        }
        subRef.current = null;
      }
    };
  }, [fetchConfig, loadBranding, loadSystemUser]);

  // Apply branding colors + document title centrally.
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.title = `${branding.platform_name} — Dashboard`;
    if (branding.primary_color) {
      document.documentElement.style.setProperty("--primary", branding.primary_color);
    }
    if (branding.accent_color) {
      document.documentElement.style.setProperty("--accent", branding.accent_color);
    }
    if (branding.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }, [branding]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const sb = getSupabaseClient();
      if (!sb || !isSupabaseConfigured()) {
        return { error: supabaseConfigError ?? "Supabase is not configured." };
      }
      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { error: null };
      } catch (err) {
        console.error("Sign-in failed", err);
        return { error: "Sign-in failed. Please try again." };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) return;
    try {
      await sb.auth.signOut();
    } catch (err) {
      console.error("Sign-out failed", err);
    }
    setUser(null);
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      configError: supabaseConfigError,
      session,
      user,
      role: user?.role ?? null,
      branding,
      brandingLoading,
      signIn,
      signOut,
      refresh,
      refreshBranding,
    }),
    [status, session, user, branding, brandingLoading, signIn, signOut, refresh, refreshBranding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

// Re-export for tests / callers that need to reset the client between cases.
export { resetSupabaseClient };
