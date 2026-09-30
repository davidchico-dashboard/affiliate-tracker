import { createFileRoute } from "@tanstack/react-router";
import { Terminal } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { canAccessDeveloperSettings } from "@/lib/permissions";
import { EmptyState, PageForbidden, PageHeader } from "@/components/app-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/developer-settings")({
  head: () => ({
    meta: [
      { title: "Developer Settings — Affiliate Tracker" },
      { name: "description", content: "Protected platform configuration and branding." },
      { property: "og:title", content: "Developer Settings — Affiliate Tracker" },
      { property: "og:description", content: "Protected platform configuration and branding." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeveloperSettingsPage,
});

function DeveloperSettingsPage() {
  const { user, branding } = useAuth();
  const role = user?.role ?? null;

  if (!canAccessDeveloperSettings(role)) {
    return <PageForbidden feature="developer settings" />;
  }

  return (
    <div>
      <PageHeader
        title="Developer Settings"
        description="Protected platform configuration and branding. Restricted to developers."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Terminal className="h-4 w-4 text-muted-foreground" aria-hidden /> Branding
              <Badge variant="secondary" className="ml-auto">
                Protected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Platform name" value={branding.platform_name} />
            <Row label="Company name" value={branding.company_name ?? "—"} />
            <Row label="Logo URL" value={branding.logo_url ?? "—"} />
            <Row label="Favicon URL" value={branding.favicon_url ?? "—"} />
            <Row label="Primary color" value={branding.primary_color ?? "default"} />
            <Row label="Accent color" value={branding.accent_color ?? "default"} />
            <Row label="Default timezone" value={branding.default_timezone ?? "UTC"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Login &amp; terminology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Login heading" value={branding.login_heading ?? "—"} />
            <Row label="Login subheading" value={branding.login_subheading ?? "—"} />
            <Row label="Support email" value={branding.support_email ?? "—"} />
            <Row label="“Affiliate” term" value={branding.affiliate_term} />
            <Row label="“User” term" value={branding.user_term} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Technical configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Terminal}
              title="No technical configuration exposed"
              description="Service-role keys, webhook secrets, and integration configuration are never exposed to the browser. These are managed in secure server-side configuration."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}
