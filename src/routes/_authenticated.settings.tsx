import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { canAccessDeveloperSettings, canEditPlatformSettings } from "@/lib/permissions";
import { EmptyState, PageForbidden, PageHeader } from "@/components/app-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Affiliate Tracker" },
      { name: "description", content: "Business and platform settings." },
      { property: "og:title", content: "Settings — Affiliate Tracker" },
      { property: "og:description", content: "Business and platform settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, branding } = useAuth();
  const role = user?.role ?? null;

  // Admins and developers reach this page; standard users are nav-blocked and
  // also gated here. Protected platform/branding fields are developer-only.
  if (role !== "admin" && role !== "developer") {
    return <PageForbidden feature="settings" />;
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Business and platform configuration. Protected fields are restricted to developers."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Business settings</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={SettingsIcon}
              title="No settings configured yet"
              description="Business settings such as default timezone and support contact will be editable here in a later phase."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              Platform &amp; branding
              <Badge variant={canEditPlatformSettings(role) ? "default" : "secondary"}>
                {canEditPlatformSettings(role) ? "Editable" : "Developer-only"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Branding for{" "}
              <span className="font-medium text-foreground">{branding.platform_name}</span> is
              configured centrally in <span className="font-mono">platform_settings</span>.
            </p>
            {canEditPlatformSettings(role) ? (
              <p className="text-muted-foreground">
                As a developer you may edit protected branding and platform settings from the
                Developer Settings area.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Protected branding fields can only be changed by a developer. Admins may view
                business settings but cannot modify platform configuration.
              </p>
            )}
            {canAccessDeveloperSettings(role) ? null : (
              <p className="text-xs text-muted-foreground">
                The Developer Settings area is hidden from your role.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
