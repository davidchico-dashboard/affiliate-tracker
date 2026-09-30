import {
  Activity,
  BarChart3,
  Globe,
  LayoutDashboard,
  Link2,
  type LucideIcon,
  Megaphone,
  Settings,
  ShieldCheck,
  Terminal,
  UserPlus,
  Users,
} from "lucide-react";

import type { SystemRole } from "./types";

/**
 * Pure, dependency-free role + navigation authorization logic.
 *
 * These helpers drive rendering and navigation ONLY. The database enforces the
 * real permissions through Row Level Security (see supabase/migrations). Hidden
 * navigation is never the only control: protected pages also call these
 * helpers to render a Forbidden state, and every mutation is gated by RLS.
 */

export const ALL_ROLES: SystemRole[] = ["developer", "admin", "user"];

export const ROLE_RANK: Record<SystemRole, number> = {
  user: 1,
  admin: 2,
  developer: 3,
};

export function isDeveloper(role?: SystemRole | null): role is "developer" {
  return role === "developer";
}

/** Admin-or-above: admins and developers. */
export function isAdminOrAbove(role?: SystemRole | null): boolean {
  return role === "admin" || role === "developer";
}

/** Manage users (create/invite/disable). Admins may manage non-developers; developers manage all. */
export function canManageUsers(role?: SystemRole | null): boolean {
  return isAdminOrAbove(role);
}

/** Only developers may manage developer accounts (promote, demote, edit, delete). */
export function canManageDevelopers(role?: SystemRole | null): boolean {
  return isDeveloper(role);
}

/** Only developers may promote anyone to the developer role. */
export function canPromoteToDeveloper(role?: SystemRole | null): boolean {
  return isDeveloper(role);
}

/** Only developers may access the protected Developer Settings area. */
export function canAccessDeveloperSettings(role?: SystemRole | null): boolean {
  return isDeveloper(role);
}

/** Only developers may edit protected platform / branding settings. */
export function canEditPlatformSettings(role?: SystemRole | null): boolean {
  return isDeveloper(role);
}

/** Whether a user with `role` may manage a target user whose current role is `targetRole`. */
export function canManageTarget(
  role: SystemRole | null | undefined,
  targetRole: SystemRole,
): boolean {
  if (isDeveloper(role)) return true;
  if (role === "admin") return targetRole !== "developer";
  return false;
}

export interface NavItem {
  label: string;
  to: string;
  roles: SystemRole[];
  icon: LucideIcon;
  description: string;
}

export const NAV: NavItem[] = [
  {
    label: "Overview",
    to: "/",
    roles: ALL_ROLES,
    icon: LayoutDashboard,
    description: "High-level metrics and recent activity.",
  },
  {
    label: "Activity",
    to: "/activity",
    roles: ALL_ROLES,
    icon: Activity,
    description: "Tracked website and funnel events.",
  },
  {
    label: "Contacts",
    to: "/contacts",
    roles: ALL_ROLES,
    icon: Users,
    description: "Identified leads and contacts.",
  },
  {
    label: "Affiliates",
    to: "/affiliates",
    roles: ALL_ROLES,
    icon: UserPlus,
    description: "Affiliates, referral partners, agents and reps.",
  },
  {
    label: "Campaigns",
    to: "/campaigns",
    roles: ALL_ROLES,
    icon: Megaphone,
    description: "Affiliate campaigns and their performance.",
  },
  {
    label: "Tracking Links",
    to: "/tracking-links",
    roles: ALL_ROLES,
    icon: Link2,
    description: "Trackable campaign links.",
  },
  {
    label: "Websites",
    to: "/websites",
    roles: ALL_ROLES,
    icon: Globe,
    description: "Sites and funnels being tracked.",
  },
  {
    label: "Reports",
    to: "/reports",
    roles: ALL_ROLES,
    icon: BarChart3,
    description: "Affiliate and campaign reporting.",
  },
  {
    label: "Users",
    to: "/users",
    roles: ["admin", "developer"],
    icon: ShieldCheck,
    description: "Manage application users and roles.",
  },
  {
    label: "Settings",
    to: "/settings",
    roles: ["admin", "developer"],
    icon: Settings,
    description: "Business and platform settings.",
  },
  {
    label: "Developer Settings",
    to: "/developer-settings",
    roles: ["developer"],
    icon: Terminal,
    description: "Protected platform configuration and branding.",
  },
];

export function getVisibleNav(role: SystemRole | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV.filter((item) => item.roles.includes(role));
}

export function findNavByPath(path: string): NavItem | undefined {
  return NAV.find((item) => item.to === path);
}

export function canAccessRoute(role: SystemRole | null | undefined, path: string): boolean {
  const item = findNavByPath(path);
  if (!item) return true; // unknown paths are not nav-gated here
  if (!role) return false;
  return item.roles.includes(role);
}
