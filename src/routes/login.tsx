import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigMissing } from "@/components/config-missing";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Affiliate Tracker" },
      { name: "description", content: "Sign in to Affiliate Tracker." },
      { property: "og:title", content: "Sign in — Affiliate Tracker" },
      { property: "og:description", content: "Sign in to Affiliate Tracker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginRoute,
});

export function LoginRoute() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect already-authenticated visitors away from the login page, in an
  // effect rather than during render.
  useEffect(() => {
    if (auth.status === "authenticated") {
      void navigate({ to: "/", replace: true });
    }
  }, [auth.status, navigate]);

  if (auth.status === "config-missing") {
    return <ConfigMissing message={auth.configError ?? "Supabase is not configured."} />;
  }

  if (auth.status === "authenticated") {
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await auth.signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    void navigate({ to: "/", replace: true });
  }

  const heading = auth.branding.login_heading ?? "Sign in to your account";
  const subheading =
    auth.branding.login_subheading ?? "Manage affiliates, campaigns, and tracked activity.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {auth.branding.platform_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {auth.branding.company_name ?? auth.branding.platform_name}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          {auth.branding.support_email ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Need help? Contact{" "}
              <a className="underline" href={`mailto:${auth.branding.support_email}`}>
                {auth.branding.support_email}
              </a>
            </p>
          ) : null}
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="h-3 w-3" aria-hidden /> Authentication is handled by Supabase Auth.
        </p>
      </div>
    </div>
  );
}
