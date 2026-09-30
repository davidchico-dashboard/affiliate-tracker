-- ============================================================================
-- Affiliate Tracker — Phase 1 foundation migration (corrected)
-- ----------------------------------------------------------------------------
-- Purpose:
--   Establish the secure application foundation: the system_users profile
--   table, the single platform_settings configuration row, role-based Row
--   Level Security, a BEFORE UPDATE trigger that rejects changes to
--   identity/system-managed columns, and an automatic trigger that creates a
--   system_users profile when a new auth user signs up.
--
-- Security assumptions:
--   - Supabase Auth is the identity source. auth.users holds the real
--     identity; system_users is the application profile linked by auth_id.
--   - The anon role can read ONLY the single platform_settings row
--     (branding/terminology needed to render the login page) and nothing else.
--     platform_settings contains no secrets.
--   - Authenticated users may read their own system_users row and the
--     platform_settings row. They may update only their own non-role,
--     non-status, non-auth_id fields, and only while their status is 'active'.
--   - Admins may read all system_users and may manage only non-developer rows,
--     and only while the acting admin's status is 'active'.
--   - Only developers may manage developer accounts and edit platform_settings,
--     and only while the acting developer's status is 'active'.
--   - A disabled or invited user (including a disabled/invited admin or
--     developer) has NO elevated access: every authenticated policy requires
--     public.current_user_status() = 'active'.
--   - Role values are lowercase: 'developer' | 'admin' | 'user'.
--   - Authorization is NEVER derived from a client-supplied role value. The
--     role is read from the database via the SECURITY DEFINER helper
--     current_user_role(), which bypasses RLS (so policies cannot recurse into
--     the very table they protect). No SELECT * is used in any helper.
--
-- Column-level protection:
--   - RLS policies control rows, not columns. A BEFORE UPDATE trigger
--     (protect_system_user_identity) enforces that id, auth_id, email, and
--     created_at can never be changed by any UPDATE, regardless of role. Only
--     full_name, avatar_url, role (subject to RLS), status (subject to RLS),
--     and updated_at (controlled by set_updated_at()) remain mutable.
--
-- Recursion avoidance:
--   - current_user_role() and current_user_status() are SECURITY DEFINER
--     functions owned by the migration runner (a superuser / table owner).
--     SECURITY DEFINER functions run as their owner, who bypasses RLS, so the
--     lookups they perform are NOT re-evaluated through the system_users RLS
--     policies. This prevents the recursive RLS evaluation that would occur if
--     a policy on system_users selected directly from system_users.
--   - Policies never issue a direct subquery against system_users in their
--     WITH CHECK; they reference the helpers instead.
--
-- Re-run safety:
--   - CREATE TABLE IF NOT EXISTS so the table sections are idempotent.
--   - Each enum/type is created only if absent.
--   - The auth_id FK is added only if the constraint is absent.
--   - Policies are DROP POLICY IF EXISTS before CREATE, so reruns are safe.
--   - Functions are CREATE OR REPLACE.
--   - Triggers are DROP TRIGGER IF EXISTS before CREATE.
--   - platform_settings row is inserted with ON CONFLICT (id) DO NOTHING.
--   - GRANT/REVOKE are idempotent.
--   - No destructive DROP TABLE / DROP COLUMN / DROP FUNCTION. This migration
--     does not delete or replace existing database objects.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Roles enum
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.name = 'system_role' AND t.typnamespace = ('public'::regnamespace)) THEN
    CREATE TYPE public.system_role AS ENUM ('developer', 'admin', 'user');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.name = 'user_status' AND t.typnamespace = ('public'::regnamespace)) THEN
    CREATE TYPE public.user_status AS ENUM ('active', 'invited', 'disabled');
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. system_users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     uuid NOT NULL UNIQUE,
  email       text NOT NULL,
  full_name   text,
  role        public.system_role NOT NULL DEFAULT 'user',
  status      public.user_status NOT NULL DEFAULT 'active',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Link auth_id to auth.users(id) so profiles cannot dangle. Added only once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_users_auth_id_fkey'
  ) THEN
    ALTER TABLE public.system_users
      ADD CONSTRAINT system_users_auth_id_fkey
      FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 3. platform_settings — a single protected configuration row (id = 1)
--    Readable before login; must never contain secrets.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id               integer PRIMARY KEY DEFAULT 1,
  platform_name    text NOT NULL DEFAULT 'Affiliate Tracker',
  company_name     text,
  logo_url         text,
  favicon_url      text,
  primary_color    text,
  accent_color     text,
  login_heading    text,
  login_subheading text,
  support_email    text,
  default_timezone text NOT NULL DEFAULT 'UTC',
  affiliate_term   text NOT NULL DEFAULT 'Affiliate',
  user_term        text NOT NULL DEFAULT 'User',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);

INSERT INTO public.platform_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. updated_at trigger function (trigger-only; not generally executable)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS system_users_set_updated_at ON public.system_users;
CREATE TRIGGER system_users_set_updated_at
  BEFORE UPDATE ON public.system_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS platform_settings_set_updated_at ON public.platform_settings;
CREATE TRIGGER platform_settings_set_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Auto-create a system_users profile on signup.
--    New signups default to the 'user' role and 'active' status. Promotion to
--    'admin'/'developer' must happen through a developer-only path (RLS below).
--    SECURITY DEFINER + fixed search_path so the trigger can insert the
--    profile even though no INSERT policy yet permits the brand-new user to do
--    so themselves.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_users (auth_id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    'user',
    'active'
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. RLS helpers — narrowly scoped SECURITY DEFINER functions.
--    These bypass RLS (owner context) so policies that reference them do NOT
--    recurse through the system_users RLS policies. Explicit search_path
--    prevents search-path-injection of unqualified names. Explicit column
--    list (never SELECT *). LIMIT 1 keeps the lookup deterministic.
-- ----------------------------------------------------------------------------

-- The role of the currently authenticated user, or NULL if no profile exists.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.system_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.system_users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- The status of the currently authenticated user, or NULL if no profile exists.
-- Used by every authenticated policy to require an 'active' acting user, and
-- by the self-update WITH CHECK to keep status immutable for the row owner.
CREATE OR REPLACE FUNCTION public.current_user_status()
RETURNS public.user_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.system_users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 7. Identity-column protection trigger function (trigger-only).
--    RLS controls rows, not columns. This BEFORE UPDATE trigger rejects any
--    change to id, auth_id, email, or created_at for EVERY update, regardless
--    of the caller's role (including developers). Only full_name, avatar_url,
--    role (subject to RLS), status (subject to RLS), and updated_at (set by
--    set_updated_at()) remain mutable. IS DISTINCT FROM handles NULL-safe
--    comparison.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_system_user_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.id          IS DISTINCT FROM NEW.id
  OR OLD.auth_id     IS DISTINCT FROM NEW.auth_id
  OR OLD.email       IS DISTINCT FROM NEW.email
  OR OLD.created_at  IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION
      'Modification of protected identity columns (id, auth_id, email, created_at) is not permitted.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS system_users_protect_identity ON public.system_users;
CREATE TRIGGER system_users_protect_identity
  BEFORE UPDATE ON public.system_users
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_user_identity();

-- ----------------------------------------------------------------------------
-- 8. Function privilege review.
--   - Role/status helpers are used only inside RLS policies, which evaluate as
--     an authenticated user. Grant EXECUTE to authenticated only; revoke from
--     PUBLIC and anon so anonymous/unclassified callers cannot invoke them.
--   - Trigger-only functions (set_updated_at, handle_new_user,
--     protect_system_user_identity) are never called directly by app users;
--     revoke from PUBLIC, anon, AND authenticated. The owner retains EXECUTE,
--     so triggers (which run as the owner for SECURITY DEFINER) still work.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.current_user_role()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role()            FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.current_user_role()            TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_status()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_status()          FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.current_user_status()          TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_system_user_identity() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Table privileges (explicit; do not rely on project default grants).
--   - Revoked from PUBLIC as well as anon/authenticated before granting, so
--     the migration does not depend on PUBLIC having no pre-existing grants.
-- ----------------------------------------------------------------------------

-- public.system_users: anonymous and PUBLIC get NO access. Authenticated users
--   get only the operations the RLS policies require: SELECT (self/admin/dev
--   reads), INSERT (admin/dev user creation; the signup trigger inserts as the
--   SECURITY DEFINER owner regardless), UPDATE (self/admin/dev), DELETE
--   (admin/dev). RLS still restricts every operation to permitted rows and
--   requires an 'active' acting user.
REVOKE ALL ON public.system_users FROM PUBLIC;
REVOKE ALL ON public.system_users FROM anon;
REVOKE ALL ON public.system_users FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_users TO authenticated;

-- public.platform_settings: revoke everything (incl. PUBLIC), then grant the
--   minimal surface.
--   - anon + authenticated may SELECT the single branding row (RLS: public
--     read). Anonymous users can still read branding for the login page.
--   - authenticated may UPDATE (RLS limits actual updates to active developers
--     only).
--   - No INSERT/DELETE to anyone via table grants (singleton row already exists).
REVOKE ALL ON public.platform_settings FROM PUBLIC;
REVOKE ALL ON public.platform_settings FROM anon;
REVOKE ALL ON public.platform_settings FROM authenticated;
GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT UPDATE ON public.platform_settings TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so the migration is safe to rerun.
DROP POLICY IF EXISTS system_users_select_self_or_admin  ON public.system_users;
DROP POLICY IF EXISTS system_users_update_self_nonrole    ON public.system_users;
DROP POLICY IF EXISTS system_users_admin_manage_nondev    ON public.system_users;
DROP POLICY IF EXISTS system_users_dev_manage_all         ON public.system_users;
DROP POLICY IF EXISTS platform_settings_select_public     ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_update_dev        ON public.platform_settings;

-- system_users: SELECT
--   - A user may read their own row, but only if the acting user is 'active'.
--   - An admin or developer may read all rows, but only if 'active'.
--   - Invited/disabled users (incl. invited/disabled admins/developers) cannot
--     read protected application data.
--   - Anonymous users have no SELECT policy here, so they cannot read
--     system_users at all.
CREATE POLICY system_users_select_self_or_admin ON public.system_users
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND (
      auth_id = auth.uid()
      OR public.current_user_role() IN ('admin', 'developer')
    )
  );

-- system_users: UPDATE (self)
--   - An authenticated, 'active' user may update only their own row.
--   - The WITH CHECK uses the RLS-bypassing helpers (not a recursive subquery)
--     to require that auth_id, role, and status are unchanged. A user therefore
--     cannot change their own role, status, or auth_id through this policy.
--   - id, auth_id, email, and created_at are additionally locked by the
--     protect_system_user_identity BEFORE UPDATE trigger for every caller.
--   - (Admin/developer updates are covered by the FOR ALL policies below; for
--     permissive policies the WITH CHECK expressions are OR-combined, so an
--     active admin/developer updating a row they are authorized for is not
--     blocked by this self policy.)
CREATE POLICY system_users_update_self_nonrole ON public.system_users
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND auth_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND auth_id = auth.uid()
    AND role = public.current_user_role()
    AND status = public.current_user_status()
  );

-- system_users: an active admin may insert/update/delete NON-developer rows
--   only.
--   - USING/WITH CHECK require the acting user to be 'active' and an admin,
--     and the existing/new row role to be IN ('user', 'admin').
--   - Admins therefore cannot touch developer rows in any way: update/delete
--     of a developer row fails here, and no promote/demote/edit/delete of
--     developers is possible.
--   - Admins cannot assign the developer role: a new row with role =
--     'developer' fails WITH CHECK (role NOT IN ('user', 'admin')).
--   - Admins cannot promote themselves to developer for the same reason.
--   - Admins may promote a 'user' to 'admin' (role IN ('user', 'admin')).
--   - A disabled or invited admin has no elevated access (status != 'active').
CREATE POLICY system_users_admin_manage_nondev ON public.system_users
  FOR ALL
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND public.current_user_role() = 'admin'
    AND role IN ('user', 'admin')
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND public.current_user_role() = 'admin'
    AND role IN ('user', 'admin')
  );

-- system_users: an active developer may insert/update/delete ALL rows,
--   including role.
--   - (The protect_system_user_identity trigger still prevents any caller,
--     including developers, from changing id, auth_id, email, or created_at.)
--   - A disabled or invited developer has no elevated access (status != 'active').
CREATE POLICY system_users_dev_manage_all ON public.system_users
  FOR ALL
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND public.current_user_role() = 'developer'
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND public.current_user_role() = 'developer'
  );

-- platform_settings: anyone (anon + authenticated) may read the single
--   branding row. This is the only public surface and contains no secrets.
--   Note: this policy does NOT call current_user_role()/current_user_status(),
--   so revoking EXECUTE on the helpers from anon does not affect the public
--   branding read, and disabled/invited users can still read branding.
CREATE POLICY platform_settings_select_public ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- platform_settings: only an 'active' developer may update protected
--   branding/config. Singleton is enforced by the PRIMARY KEY + CHECK (id = 1).
--   A disabled or invited developer cannot mutate platform_settings.
CREATE POLICY platform_settings_update_dev ON public.platform_settings
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND public.current_user_role() = 'developer'
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND public.current_user_role() = 'developer'
  );

-- ----------------------------------------------------------------------------
-- 11. Operator notes
-- ----------------------------------------------------------------------------
-- After running this migration (do NOT run it inside the application):
--   1. Enable email/password auth in Supabase (Dashboard > Authentication).
--   2. Create the first developer: sign up a user, then in SQL set their row:
--        UPDATE public.system_users SET role = 'developer'
--        WHERE email = 'you@yourdomain.com';
--      (Run as a privileged role / via the SQL editor with service access.)
--   3. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment env.
--   4. NEVER expose SUPABASE_SERVICE_ROLE_KEY through a VITE_ variable, the
--      frontend bundle, browser requests, logs, or error messages. If a
--      service-role key is ever needed, read it only inside trusted
--      server-side code (process.env.SUPABASE_SERVICE_ROLE_KEY within a
--      createServerFn/.server.ts handler).
-- ============================================================================
