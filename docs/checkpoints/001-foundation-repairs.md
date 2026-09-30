# Checkpoint 001 — Foundation repairs

Date: 2026-09-30. Parent checkpoint: [000-baseline.md](000-baseline.md).

## Changes

- Corrected `pg_type.typname` lookups in migrations 0001 and 0002. A fresh database can now apply both files and rerun them without duplicate-object failures.
- Phase 2 `created_by` now sends the signed-in `system_users.id`, matching the foreign keys on affiliates, campaigns, and tracking links. The Supabase Auth ID remains available separately as `auth_id` for authentication.
- Login always calls its React hooks in the same order. The configured/missing-configuration states no longer change hook ordering.
- Removed a redundant nested route outlet passed as children to the application shell. The shell's own `<Outlet />` renders protected routes.
- Fixed strict TypeScript errors from optional props, index-signature access, and the `PlatformSettings` type import. Added `typecheck` and `test` package scripts.
- Added two database integration tests: migration apply/rerun, and the `created_by` profile-ID foreign-key contract.

## Verification

| Check | Result |
| --- | --- |
| `bun run typecheck` | Pass; 0 diagnostics (was 51) |
| `bun run test` | Pass; 45 tests across 6 files (was 43) |
| `bun run build` | Pass |
| `bun run lint` | Pass; 0 errors, 9 existing Fast Refresh warnings |
| Database integration | 0001 + 0002 apply and rerun in isolated PostgreSQL (PGlite); wrong Auth ID fails FK, profile ID succeeds |
| `git diff --check` | Pass |
| Local route smoke test | `/` and `/login` returned HTTP 200 without server Supabase configuration |

## Deployment note

The modified migration files repair **fresh** client installs. They do not automatically alter a previously configured Supabase project. The user previously applied a copy of 0001 and created a Developer account; 0002's live application status is unverified. Do not rerun migrations on the existing project merely because these source files changed. Compare live schema/migration history before applying anything there.

## Open MVP work

The tracking pixel, public collection endpoint, visitor/session/event store, GHL webhook identity matching, conversions, and real activity/reporting still need implementation. User management and branding editing are still read-only placeholders. Additional audit findings from Checkpoint 000 remain open, especially auth/profile state behavior, query-error handling, and enforcing tracking-link attribution values in the database.
