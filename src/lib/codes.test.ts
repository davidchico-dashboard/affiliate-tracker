import { describe, expect, it } from "vitest";

import { normalizeCode, isValidCode, isValidHttpUrl, buildTrackingUrl } from "@/lib/codes";

describe("code normalization", () => {
  it("lowercases, trims, and collapses spaces to hyphens", () => {
    expect(normalizeCode("  My Affiliate Code  ")).toBe("my-affiliate-code");
  });

  it("strips disallowed characters but keeps hyphens and underscores", () => {
    expect(normalizeCode("A!B@C#D_E-F")).toBe("abcd_e-f");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("   ")).toBe("");
  });

  it("is idempotent on already-normalized input", () => {
    expect(normalizeCode("alpha-12_xy")).toBe("alpha-12_xy");
  });
});

describe("code validation", () => {
  it("accepts lowercase letters, numbers, hyphens, underscores", () => {
    expect(isValidCode("abc123")).toBe(true);
    expect(isValidCode("alpha-12_xy")).toBe(true);
  });

  it("rejects empty after normalization", () => {
    expect(isValidCode("")).toBe(false);
    expect(isValidCode("   ")).toBe(false);
  });

  it("rejects codes that normalize to empty or invalid", () => {
    expect(isValidCode("!!!")).toBe(false);
  });
});

describe("url validation", () => {
  it("accepts absolute http and https", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("rejects relative or non-http protocols", () => {
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("not-a-url")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl("/relative/path")).toBe(false);
  });
});

describe("buildTrackingUrl", () => {
  it("appends ref/campaign/tl when the destination has no query params", () => {
    const out = buildTrackingUrl("https://example.com/landing", "jdoe", "spring-sale", "tl1");
    expect(out).toBe("https://example.com/landing?ref=jdoe&campaign=spring-sale&tl=tl1");
  });

  it("preserves existing query parameters", () => {
    const out = buildTrackingUrl(
      "https://example.com/landing?utm_source=email&page=2",
      "jdoe",
      "spring-sale",
      "tl1",
    );
    const u = new URL(out);
    expect(u.searchParams.get("utm_source")).toBe("email");
    expect(u.searchParams.get("page")).toBe("2");
    expect(u.searchParams.get("ref")).toBe("jdoe");
    expect(u.searchParams.get("campaign")).toBe("spring-sale");
    expect(u.searchParams.get("tl")).toBe("tl1");
  });

  it("URL-encodes values that need encoding", () => {
    // Codes are normalized before reaching here in practice, but the builder
    // must still encode any value it is given.
    const out = buildTrackingUrl("https://example.com/landing", "j doe", "a b", "t/l");
    const u = new URL(out);
    expect(u.searchParams.get("ref")).toBe("j doe");
    expect(u.searchParams.get("campaign")).toBe("a b");
    expect(u.searchParams.get("tl")).toBe("t/l");
    // The serialized form must percent-encode the slash and encode the spaces
    // (URLSearchParams uses "+" for spaces and "%2F" for slashes).
    expect(out).toContain("tl=t%2Fl");
    expect(out).toMatch(/ref=j(\+|%20)doe/);
  });

  it("returns the destination unchanged when it is not a valid absolute URL", () => {
    expect(buildTrackingUrl("not-a-url", "jdoe", "c", "t")).toBe("not-a-url");
  });
});
