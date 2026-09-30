import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AuthGate } from "@/components/auth-gate";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AuthGate>
      <Outlet />
    </AuthGate>
  );
}
