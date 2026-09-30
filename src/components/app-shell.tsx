import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, ShieldCheck, Terminal } from "lucide-react";

import { getVisibleNav } from "@/lib/permissions";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function BrandMark({ platformName, logoUrl }: { platformName: string; logoUrl?: string | null }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={platformName} className="h-7 w-auto" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <ShieldCheck className="h-5 w-5" aria-hidden />
    </span>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { role, branding } = useAuth();
  const location = useLocation();
  const items = getVisibleNav(role);
  const current = location.pathname;

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {items.map((item) => {
        const active = current === item.to || (item.to !== "/" && current.startsWith(item.to));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function DevBadge({ role }: { role: string | null }) {
  if (role !== "developer") return null;
  return (
    <Badge variant="secondary" className="ml-auto gap-1">
      <Terminal className="h-3 w-3" aria-hidden /> Dev
    </Badge>
  );
}

function UserMenu() {
  const { user, branding, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const initials = (user.full_name || user.email || "?")
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2 pr-3">
      <Avatar className="h-8 w-8">
        {user.avatar_url ? (
          <AvatarImage src={user.avatar_url} alt={user.full_name ?? user.email} />
        ) : null}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {user.full_name ?? "Unnamed"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        onClick={async () => {
          await signOut();
          void navigate({ to: "/login" });
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

export function AppShell() {
  const { branding } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar p-4 lg:flex">
        <div className="flex items-center gap-2 px-2 py-2">
          <BrandMark platformName={branding.platform_name} logoUrl={branding.logo_url} />
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            {branding.platform_name}
          </span>
        </div>
        <Separator className="my-3" />
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <Separator className="my-3" />
        <UserMenu />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <BrandMark platformName={branding.platform_name} logoUrl={branding.logo_url} />
            <span className="truncate text-sm font-semibold text-foreground">
              {branding.platform_name}
            </span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <BrandMark platformName={branding.platform_name} logoUrl={branding.logo_url} />
                  <span>{branding.platform_name}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex h-[calc(100%-6rem)] flex-col">
                <div className="flex-1 overflow-y-auto">
                  <NavList onNavigate={() => setMobileOpen(false)} />
                </div>
                <DevBadge role={useAuth().role} />
                <div className="mt-3">
                  <UserMenu />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Desktop top bar */}
        <header className="hidden items-center justify-between border-b border-border bg-card px-6 py-3 lg:flex">
          <div className="text-sm font-medium text-muted-foreground" id="active-module-label" />
          <div className="flex items-center gap-2">
            <DevBadge role={useAuth().role} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
