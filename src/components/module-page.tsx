import type { LucideIcon } from "lucide-react";

import { EmptyState, PageHeader, PageForbidden } from "@/components/app-ui";
import { useAuth } from "@/lib/auth-context";
import { canAccessRoute } from "@/lib/permissions";

/**
 * Standard module page for foundation-phase modules that ship only empty
 * states. Enforces role-based access at the view layer in addition to RLS.
 */
export function ModulePage({
  path,
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
}: {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { role } = useAuth();

  if (!canAccessRoute(role, path)) {
    return <PageForbidden feature={title} />;
  }

  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} className="mt-2" />
    </div>
  );
}
