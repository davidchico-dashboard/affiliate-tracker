// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

const migrationDirectory = new URL("../../supabase/migrations/", import.meta.url);
const migrationNames = [
  "0001_affiliate_tracker_foundation.sql",
  "0002_affiliates_campaigns_tracking_links.sql",
];
let db: PGlite | null = null;

async function database() {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      raw_user_meta_data jsonb
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
  `);
  return db;
}

async function migrate(connection: PGlite) {
  for (const name of migrationNames) {
    await connection.exec(readFileSync(new URL(name, migrationDirectory), "utf8"));
  }
}

afterEach(async () => {
  await db?.close();
  db = null;
});

describe("database migrations", () => {
  it("applies both migrations to a clean database and can rerun them", async () => {
    const connection = await database();
    await migrate(connection);
    await migrate(connection);

    const { rows } = await connection.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('system_users', 'platform_settings', 'affiliates', 'campaigns', 'tracking_links')
      ORDER BY table_name
    `);
    expect(rows.map((row) => row.table_name)).toEqual([
      "affiliates",
      "campaigns",
      "platform_settings",
      "system_users",
      "tracking_links",
    ]);
  });

  it("links created_by to the profile ID, not the Auth user ID", async () => {
    const connection = await database();
    await migrate(connection);
    const authId = "11111111-1111-4111-8111-111111111111";
    await connection.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'admin@example.com')`, [
      authId,
    ]);
    // The signup trigger creates a distinct system_users primary key.
    const profile = await connection.query<{ id: string }>(
      `SELECT id FROM public.system_users WHERE auth_id = $1`,
      [authId],
    );
    const actualProfileId = profile.rows[0]?.id;
    expect(actualProfileId).toBeDefined();
    expect(actualProfileId).not.toBe(authId);

    await connection.query(
      `INSERT INTO public.affiliates (affiliate_code, display_name, created_by)
       VALUES ('profile-ref', 'Profile Ref', $1)`,
      [actualProfileId],
    );
    await expect(
      connection.query(
        `INSERT INTO public.affiliates (affiliate_code, display_name, created_by)
       VALUES ('auth-ref', 'Auth Ref', $1)`,
        [authId],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
});
