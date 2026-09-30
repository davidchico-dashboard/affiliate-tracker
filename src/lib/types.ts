/**
 * Shared application types.
 *
 * Role values are lowercase database values: "developer" | "admin" | "user".
 * Never derive authorization from a client-supplied role string; these types
 * describe the value resolved from the database (RLS-protected read) and used
 * for rendering/navigation only. Real authorization is enforced by RLS.
 */

export type SystemRole = "developer" | "admin" | "user";

export type UserStatus = "active" | "invited" | "disabled";

export interface SystemUser {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string | null;
  role: SystemRole;
  status: UserStatus;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettings {
  id: number;
  platform_name: string;
  company_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  login_heading: string | null;
  login_subheading: string | null;
  support_email: string | null;
  default_timezone: string | null;
  affiliate_term: string;
  user_term: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "config-missing";
