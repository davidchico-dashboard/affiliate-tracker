/**
 * Phase 2 role helpers for affiliates/campaigns/tracking-links management.
 *
 * These drive rendering/navigation ONLY. The database enforces the real
 * permissions through RLS. Hidden navigation is never the only control.
 */

import type { SystemRole } from "./types";

/** Active admin or developer may create/update/archive records. */
export function canManageRecords(role?: SystemRole | null): boolean {
  return role === "admin" || role === "developer";
}

/** Standard users are read-only for Phase 2 records. */
export function isRecordReaderOnly(role?: SystemRole | null): boolean {
  return role === "user";
}
