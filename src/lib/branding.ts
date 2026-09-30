import type { PlatformSettings } from "./types";

/**
 * Centralized branding configuration with safe fallback defaults.
 *
 * The live values come from the single `platform_settings` row (read through
 * RLS by BrandingProvider). When Supabase is unconfigured or the row is
 * missing, these defaults keep the interface fully renderable so the master
 * template can be previewed and duplicated before credentials are supplied.
 */

export const DEFAULT_BRANDING: PlatformSettings = {
  id: 1,
  platform_name: "Affiliate Tracker",
  company_name: null,
  logo_url: null,
  favicon_url: null,
  primary_color: null,
  accent_color: null,
  login_heading: "Sign in to your account",
  login_subheading: "Manage affiliates, campaigns, and tracked activity.",
  support_email: null,
  default_timezone: "UTC",
  affiliate_term: "Affiliate",
  user_term: "User",
};

/**
 * Merge partial platform settings over the defaults. Null/undefined fields
 * fall back to DEFAULT_BRANDING so the UI always has a complete config object.
 */
export function resolveBranding(
  partial: Partial<PlatformSettings> | null | undefined,
): PlatformSettings {
  return {
    ...DEFAULT_BRANDING,
    ...((partial ?? {}) as Partial<PlatformSettings>),
    id: partial?.id ?? DEFAULT_BRANDING.id,
    affiliate_term: partial?.affiliate_term ?? DEFAULT_BRANDING.affiliate_term,
    user_term: partial?.user_term ?? DEFAULT_BRANDING.user_term,
    platform_name: partial?.platform_name ?? DEFAULT_BRANDING.platform_name,
  };
}

/** Best-effort application of branding colors to the design-system CSS variables. */
export function applyBrandingColors(branding: PlatformSettings): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (branding.primary_color) {
    root.style.setProperty("--primary", branding.primary_color);
  }
  if (branding.accent_color) {
    root.style.setProperty("--accent", branding.accent_color);
  }
}
