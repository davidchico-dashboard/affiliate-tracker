import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { canManageUsers, canManageDevelopers } from "@/lib/permissions";
import { EmptyState, PageForbidden, PageHeader } from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users — Affiliate Tracker" },
      { name: "description", content: "Manage application users and roles." },
      { property: "og:title", content: "Users — Affiliate Tracker" },
      { property: "og:description", content: "Manage application users and roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { user, branding } = useAuth();
  const role = user?.role ?? null;

  if (!canManageUsers(role)) {
    return <PageForbidden feature="user management" />;
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage application users and roles. Role changes are enforced by Row Level Security."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden /> Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={ShieldCheck}
              title="No users to display"
              description={`Application ${branding.user_term.toLowerCase()}s will be listed here with their role and status. User management actions are wired in a later phase.`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <PermissionRow label="Manage users" allowed={canManageUsers(role)} />
            <PermissionRow
              label="Manage developers"
              allowed={canManageDevelopers(role)}
              note={canManageDevelopers(role) ? undefined : "Developer-only"}
            />
            <PermissionRow
              label="Promote to developer"
              allowed={canManageDevelopers(role)}
              note={canManageDevelopers(role) ? undefined : "Developer-only"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PermissionRow({
  label,
  allowed,
  note,
}: {
  label: string;
  allowed: boolean;
  note?: string | undefined;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={allowed ? "default" : "secondary"}>
        {allowed ? "Allowed" : (note ?? "Restricted")}
      </Badge>
    </div>
  );
}
