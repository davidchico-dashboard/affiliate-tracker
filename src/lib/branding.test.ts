import { describe, expect, it } from "vitest";

import { DEFAULT_BRANDING, resolveBranding, applyBrandingColors } from "@/lib/branding";
import type { PlatformSettings } from "@/lib/types";

describe("resolveBranding fallback", () => {
  it("returns defaults when given null/undefined", () => {
    expect(resolveBranding(null)).toEqual(DEFAULT_BRANDING);
    expect(resolveBranding(undefined)).toEqual(DEFAULT_BRANDING);
    expect(resolveBranding({})).toEqual(DEFAULT_BRANDING);
  });

  it("uses default platform_name when not provided", () => {
    const b = resolveBranding({});
    expect(b.platform_name).toBe("Affiliate Tracker");
  });

  it("merges provided values over defaults", () => {
    const b = resolveBranding({
      platform_name: "Acme Referrals",
      company_name: "Acme Co",
      primary_color: "oklch(0.5 0.2 250)",
      affiliate_term: "Partner",
    } as Partial<PlatformSettings>);
    expect(b.platform_name).toBe("Acme Referrals");
    expect(b.company_name).toBe("Acme Co");
    expect(b.primary_color).toBe("oklch(0.5 0.2 250)");
    expect(b.affiliate_term).toBe("Partner");
    // untouched fields fall back to defaults
    expect(b.default_timezone).toBe("UTC");
    expect(b.user_term).toBe("User");
  });

  it("handles null field values by keeping them (null is a valid empty state)", () => {
    const b = resolveBranding({ company_name: null } as Partial<PlatformSettings>);
    expect(b.company_name).toBeNull();
    expect(b.platform_name).toBe("Affiliate Tracker");
  });
});

describe("applyBrandingColors", () => {
  it("does not throw when window is undefined (SSR guard)", () => {
    expect(() => applyBrandingColors(DEFAULT_BRANDING)).not.toThrow();
  });
});
