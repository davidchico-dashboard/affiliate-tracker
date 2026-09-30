/**
 * Code normalization and trackable URL construction (pure, dependency-free).
 *
 * Codes are normalized to lowercase, trimmed, with spaces replaced by hyphens
 * and only lowercase letters, numbers, hyphens, and underscores retained.
 * The database CHECK constraint mirrors this for defense in depth.
 *
 * URL construction preserves existing query parameters on the destination URL
 * and appends the attribution parameters ref, campaign, and tl using proper
 * URL encoding. It never silently fabricates click/conversion totals.
 */

const CODE_ALLOWED = /[^a-z0-9_-]/g;

/**
 * Normalize an affiliate/campaign/tracking code: lowercase, trim, collapse
 * internal whitespace to hyphens, then strip disallowed characters. Returns
 * an empty string when the input is blank so callers can reject it.
 */
export function normalizeCode(input: string): string {
  if (!input) return "";
  return input.trim().toLowerCase().replace(/\s+/g, "-").replace(CODE_ALLOWED, "");
}

/** A code is valid when, after normalization, it is non-empty and matches the
 *  URL-safe pattern enforced by the database. */
export function isValidCode(input: string): boolean {
  const normalized = normalizeCode(input);
  return /^[a-z0-9][a-z0-9_-]*$/.test(normalized);
}

/** A URL is valid when it is an absolute http(s) URL. */
export function isValidHttpUrl(input: string): boolean {
  if (!input) return false;
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Build a trackable URL by appending attribution parameters to a destination.
 *
 * - Existing query parameters on the destination URL are preserved.
 * - `ref` = the affiliate code, `campaign` = the campaign code, `tl` = the
 *   tracking code, each URL-encoded.
 * - Returns the original destination unchanged when it is not a valid absolute
 *   http(s) URL (callers should validate before building).
 */
export function buildTrackingUrl(
  destinationUrl: string,
  affiliateCode: string,
  campaignCode: string,
  trackingCode: string,
): string {
  if (!isValidHttpUrl(destinationUrl)) return destinationUrl;
  const url = new URL(destinationUrl);
  url.searchParams.set("ref", affiliateCode);
  url.searchParams.set("campaign", campaignCode);
  url.searchParams.set("tl", trackingCode);
  return url.toString();
}
