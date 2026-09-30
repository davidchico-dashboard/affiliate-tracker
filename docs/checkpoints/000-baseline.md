# Checkpoint 000 — AI Studio export audit

Date: 2026-09-30. Source: `affiliate-dashboar-4.zip` (114 files).
SHA-256: `a747a6b9f9ee61648f329c3b7a6849b83fbe5226d5070ad3f6ee7ce08bd61d67`.

This checkpoint preserves the exported application. It is a baseline, not an MVP release. No live Supabase connection, credentials, migrations, or deployment were changed. GitHub was empty at import. The committed app and migrations match the export; `.gitignore` adds secret/build-test exclusions and this document records the audit.

## Checks on the imported source

- Frozen Bun lockfile installed using Bun 1.4.2, Node 26.5.0. In this sandbox, an explicitly writable temporary/cache directory and `--backend copy --ignore-scripts` were used. No lockfile change.
- Vitest: **43 passed in 5 files**.
- Vite production build: **passed**. This command does not perform TypeScript checking.
- TypeScript (`tsc --noEmit`): **failed**, 51 diagnostics across application files.
- ESLint: **failed**, 2 errors and 9 Fast Refresh warnings.
- Both SQL migrations: **failed** in isolated PGlite/PostgreSQL execution with minimal Supabase Auth schema/roles. Error `42703: column t.name does not exist`. Migration 0002 was tested separately after correcting 0001 only in the test's memory.
- Pattern scan found no embedded GitHub tokens, Supabase secret keys, JWT literals, or private keys in exported source. No `.env` files were supplied. This is not a comprehensive credential audit.
- Live login, hosted preview, and actual deployed schema: **not tested in this checkpoint**. Previous user reports confirmed Phase 1 login; they do not prove that this export matches the live database.

## Findings

1. **P1: Clean installations fail.** Both migration enum checks use `pg_type.t.name`; the PostgreSQL field is `typname`. The full migration pasted earlier in chat used the correct name for Phase 1, explaining how the live account could exist despite the broken exported file.
2. **P1: Phase 2 creation uses the wrong identity.** `phase2-data.ts` supplies `user.auth_id` for `created_by`, while all three foreign keys reference `system_users.id`. These UUIDs are different, so ordinary create operations fail with a foreign-key violation.
3. **P1: Login breaks React's hook order.** `login.tsx` returns on `config-missing` before calling `useEffect`. A configuration-state transition changes the number of hooks rendered.
4. **P2: Auth/profile state needs hardening.** `auth-context.tsx` awaits a Supabase profile request inside the Auth callback; it also sets authenticated status when profile lookup returns null. It lacks a guard around `configureSupabase()` and does not cancel stale profile responses after sign-out/account changes. Exercise these paths before release.
5. **P2: Counts hide failed queries.** `useOverviewCounts` ignores Supabase errors and reports zero, making missing tables or denied access look like valid zero totals.
6. **P2: Data validation/reporting gaps.** Empty optional UUID/date fields can remain empty strings; raw search text is interpolated into PostgREST filter syntax; campaign UTM defaults are stored but not used when building links. Tracking identity fields are frozen in the UI, but can still be changed through direct permitted database updates. `created_by` is client-supplied rather than enforced server-side.
7. **P2: Type checking is not a release gate.** Errors include optional props, index-signature access, an unexported `PlatformSettings` import, and passing children to an AppShell that renders its own Outlet.
8. **P2: Production boundary displays raw errors/stacks.** Keep details in development and server diagnostics, with a generic production user-facing message.
9. **Scope decision before release:** Phase 2 currently allows every active standard User to read all affiliates, campaigns, links, and affiliate contact/notes fields. This follows the last Phase 2 prompt, but does not implement affiliate-specific visibility from the original product idea.

## Actual feature inventory

- Implemented: auth shell, role navigation, branding reads, affiliates/campaigns/links forms and tables, URL builder, two count queries, two migrations.
- UI placeholders: Users management, editable Settings/branding, Websites, Activity, Contacts, Reports, visitor/click/conversion metrics.
- Not present: pixel, collection endpoint, sessions/events, webhook identity matching, conversion ingestion, reporting/export workflow, duplication guide.
- No business-directory/Google Places implementation in this export; keep that separate from the affiliate attribution MVP.

## Checkpoint workflow

For each bounded change: inspect the diff, test the affected behavior, run typecheck/tests/build and lint, document remaining limitations, commit, push without force, and verify the remote commit SHA. Never amend or rewrite published history (see AGENTS.md). Database files and application commits are separate from applying SQL to a live project.

Next checkpoint: repair the demonstrated migration/create/login failures and establish repeatable type, test, build, and database checks. Then implement website/pixel collection, GHL identity matching, useful reporting, and client setup/branding.
