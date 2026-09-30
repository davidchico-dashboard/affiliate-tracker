import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/app-ui";
import { ConfigMissing } from "@/components/config-missing";

/**
 * Renders an authenticated app shell around `children`, or the appropriate
 * gate state (loading / config-missing / redirect-to-login).
 *
 * This is the real access control at the view layer. The database additionally
 * enforces Row Level Security, so a tampered client cannot read or write data
 * its role is not permitted to access, regardless of navigation.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      void navigate({ to: "/login", replace: true });
    }
  }, [auth.status, navigate]);

  if (auth.status === "config-missing") {
    return <ConfigMissing message={auth.configError ?? "Supabase is not configured."} />;
  }
  if (auth.status === "loading") {
    return <PageLoading label="Starting Affiliate Tracker…" />;
  }
  if (auth.status === "unauthenticated") {
    return <PageLoading label="Redirecting to sign in…" />;
  }
  return <AppShell>{children}</AppShell>;
}
