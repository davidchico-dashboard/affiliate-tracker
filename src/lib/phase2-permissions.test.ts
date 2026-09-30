import { describe, expect, it } from "vitest";

import { canManageRecords, isRecordReaderOnly } from "@/lib/phase2-permissions";

describe("phase 2 record permissions", () => {
  it("canManageRecords: admin and developer only", () => {
    expect(canManageRecords("admin")).toBe(true);
    expect(canManageRecords("developer")).toBe(true);
    expect(canManageRecords("user")).toBe(false);
    expect(canManageRecords(null)).toBe(false);
  });

  it("isRecordReaderOnly: only the standard user role", () => {
    expect(isRecordReaderOnly("user")).toBe(true);
    expect(isRecordReaderOnly("admin")).toBe(false);
    expect(isRecordReaderOnly("developer")).toBe(false);
    expect(isRecordReaderOnly(null)).toBe(false);
  });

  it("a standard user cannot manage records (read-only)", () => {
    expect(canManageRecords("user")).toBe(false);
    expect(isRecordReaderOnly("user")).toBe(true);
  });
});
