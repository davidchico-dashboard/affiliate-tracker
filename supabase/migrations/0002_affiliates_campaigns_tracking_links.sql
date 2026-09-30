-- ============================================================================
-- Affiliate Tracker — Phase 2 migration: affiliates, campaigns, tracking_links
-- ----------------------------------------------------------------------------
-- Purpose:
--   Add the operational data model for affiliate management, campaign
--   management, and trackable URL generation. This phase does NOT implement
--   the tracking pixel, click/visitor event collection, GHL webhooks, contact
--   identification, conversions, commissions, or advanced analytics.
--
-- Prerequisite:
--   0001_affiliate_tracker_foundation.sql must be applied first. It creates
--   public.system_users, public.platform_settings, the system_role /
--   user_status enums, the current_user_role() / current_user_status()
--   SECURITY DEFINER helpers (with fixed search_path), and the
--   set_updated_at() trigger function.
--
-- Security assumptions:
--   - Supabase Auth is the identity source. Authorization is NEVER derived
--     from a client-supplied role value. The role is read from the database
--     via the Phase 1 SECURITY DEFINER helpers current_user_role() and
--     current_user_status(), which bypass RLS and so do not recurse.
--   - Any active authenticated user (developer, admin, or user) may READ
--     affiliates, campaigns, and tracking_links.
--   - Only ACTIVE developers and admins may CREATE, UPDATE, or DELETE records.
--   - A disabled/invited user (including a disabled/invited admin/developer)
--     has NO access: every policy requires current_user_status() = 'active'.
--   - Standard users may READ but not create/update/delete (read-only).
--   - Anonymous users receive NO access to any of these tables.
--   - The interface avoids hard deletes by using status = 'archived'; DELETE is
--     still permitted by RLS for active admin/developer so administrators can
--     correct mistakes, but the UI does not expose a destructive action.
--   - Codes are normalized to lowercase and constrained to URL-safe characters.
--     A UNIQUE constraint prevents duplicate codes regardless of letter casing
--     (codes are always stored lowercased; the CHECK regex rejects uppercase).
--   - destination_url values must use http or https. Campaign end_date, when
--     both dates are present, may not precede start_date.
--   - generated_url is captured at creation time and is NOT automatically
--     rewritten if an affiliate or campaign code changes later, preserving
--     historical link integrity.
--
-- Re-run safety:
--   - CREATE TABLE IF NOT EXISTS.
--   - Enums created only if absent.
--   - FK constraints added only if absent.
--   - Policies DROP IF EXISTS before CREATE.
--   - Triggers DROP IF EXISTS before CREATE.
--   - Indexes CREATE IF NOT EXISTS.
--   - GRANT/REVOKE idempotent.
--   - No destructive DROP TABLE / DROP COLUMN / DROP FUNCTION.
--   - Does not modify 0001 or any existing database object.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums (created only if absent; shared with Phase 1 naming conventions)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.name = 'affiliate_status' AND t.typnamespace = ('public'::regnamespace)) THEN
    CREATE TYPE public.affiliate_status AS ENUM ('active', 'inactive', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.name = 'campaign_status' AND t.typnamespace = ('public'::regnamespace)) THEN
    CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'paused', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.name = 'tracking_link_status' AND t.typnamespace = ('public'::regnamespace)) THEN
    CREATE TYPE public.tracking_link_status AS ENUM ('active', 'inactive', 'archived');
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 2. affiliates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affiliates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code text NOT NULL,
  display_name   text NOT NULL,
  legal_name     text,
  email          text,
  phone          text,
  company_name   text,
  system_user_id uuid,
  status         public.affiliate_status NOT NULL DEFAULT 'active',
  notes          text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Codes are normalized to lowercase, URL-safe characters only.
  CONSTRAINT affiliates_affiliate_code_format
    CHECK (affiliate_code ~ '^[a-z0-9][a-z0-9_-]*$'),
  CONSTRAINT affiliates_display_name_nonempty
    CHECK (length(btrim(display_name)) > 0)
);

-- Unique code (case-insensitive safety; codes are stored lowercase, so this
-- also rejects an exact duplicate regardless of the input casing path).
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_affiliate_code_uniq
  ON public.affiliates (lower(affiliate_code));

-- Optional link to an application user (an affiliate need not have login).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliates_system_user_id_fkey'
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_system_user_id_fkey
      FOREIGN KEY (system_user_id) REFERENCES public.system_users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliates_created_by_fkey'
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.system_users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 3. campaigns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code     text NOT NULL,
  name              text NOT NULL,
  description      text,
  destination_url   text NOT NULL,
  status            public.campaign_status NOT NULL DEFAULT 'draft',
  start_date        date,
  end_date          date,
  default_utm_source  text,
  default_utm_medium  text,
  default_utm_campaign text,
  created_by        uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_campaign_code_format
    CHECK (campaign_code ~ '^[a-z0-9][a-z0-9_-]*$'),
  CONSTRAINT campaigns_name_nonempty
    CHECK (length(btrim(name)) > 0),
  -- destination_url must be an absolute http(s) URL.
  CONSTRAINT campaigns_destination_url_protocol
    CHECK (destination_url ~* '^https?://'),
  -- end_date may not precede start_date when both are present.
  CONSTRAINT campaigns_date_range
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_campaign_code_uniq
  ON public.campaigns (lower(campaign_code));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_created_by_fkey'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.system_users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 4. tracking_links
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code  text NOT NULL,
  name           text NOT NULL,
  affiliate_id   uuid NOT NULL,
  campaign_id    uuid NOT NULL,
  destination_url text NOT NULL,
  generated_url  text NOT NULL,
  status         public.tracking_link_status NOT NULL DEFAULT 'active',
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_links_tracking_code_format
    CHECK (tracking_code ~ '^[a-z0-9][a-z0-9_-]*$'),
  CONSTRAINT tracking_links_name_nonempty
    CHECK (length(btrim(name)) > 0),
  CONSTRAINT tracking_links_destination_url_protocol
    CHECK (destination_url ~* '^https?://'),
  CONSTRAINT tracking_links_generated_url_protocol
    CHECK (generated_url ~* '^https?://')
);

CREATE UNIQUE INDEX IF NOT EXISTS tracking_links_tracking_code_uniq
  ON public.tracking_links (lower(tracking_code));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracking_links_affiliate_id_fkey'
  ) THEN
    ALTER TABLE public.tracking_links
      ADD CONSTRAINT tracking_links_affiliate_id_fkey
      FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracking_links_campaign_id_fkey'
  ) THEN
    ALTER TABLE public.tracking_links
      ADD CONSTRAINT tracking_links_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracking_links_created_by_fkey'
  ) THEN
    ALTER TABLE public.tracking_links
      ADD CONSTRAINT tracking_links_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.system_users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 5. updated_at triggers (reuse the Phase 1 set_updated_at() function)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS affiliates_set_updated_at ON public.affiliates;
CREATE TRIGGER affiliates_set_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS campaigns_set_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_set_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tracking_links_set_updated_at ON public.tracking_links;
CREATE TRIGGER tracking_links_set_updated_at
  BEFORE UPDATE ON public.tracking_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Indexes for filtering and FK lookups
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS affiliates_status_idx        ON public.affiliates (status);
CREATE INDEX IF NOT EXISTS affiliates_system_user_id_idx ON public.affiliates (system_user_id);
CREATE INDEX IF NOT EXISTS affiliates_created_by_idx   ON public.affiliates (created_by);

CREATE INDEX IF NOT EXISTS campaigns_status_idx         ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_created_by_idx    ON public.campaigns (created_by);

CREATE INDEX IF NOT EXISTS tracking_links_status_idx   ON public.tracking_links (status);
CREATE INDEX IF NOT EXISTS tracking_links_affiliate_id_idx ON public.tracking_links (affiliate_id);
CREATE INDEX IF NOT EXISTS tracking_links_campaign_id_idx  ON public.tracking_links (campaign_id);
CREATE INDEX IF NOT EXISTS tracking_links_created_by_idx   ON public.tracking_links (created_by);

-- ----------------------------------------------------------------------------
-- 7. Table privileges (explicit; do not rely on default grants)
--    Anonymous and PUBLIC receive NO access to any Phase 2 table.
--    Authenticated users get SELECT (read) plus INSERT/UPDATE/DELETE so RLS
--    can permit active admin/developer writes; RLS still restricts every
--    operation to permitted rows and requires an active acting user.
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.affiliates FROM PUBLIC;
REVOKE ALL ON public.affiliates FROM anon;
REVOKE ALL ON public.affiliates FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliates TO authenticated;

REVOKE ALL ON public.campaigns FROM PUBLIC;
REVOKE ALL ON public.campaigns FROM anon;
REVOKE ALL ON public.campaigns FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;

REVOKE ALL ON public.tracking_links FROM PUBLIC;
REVOKE ALL ON public.tracking_links FROM anon;
REVOKE ALL ON public.tracking_links FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_links TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.affiliates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_links  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so the migration is safe to rerun.
DROP POLICY IF EXISTS affiliates_select_active       ON public.affiliates;
DROP POLICY IF EXISTS affiliates_write_admin_dev    ON public.affiliates;
DROP POLICY IF EXISTS campaigns_select_active        ON public.campaigns;
DROP POLICY IF EXISTS campaigns_write_admin_dev     ON public.campaigns;
DROP POLICY IF EXISTS tracking_links_select_active   ON public.tracking_links;
DROP POLICY IF EXISTS tracking_links_write_admin_dev ON public.tracking_links;

-- affiliates: any active authenticated user may read.
CREATE POLICY affiliates_select_active ON public.affiliates
  FOR SELECT
  TO authenticated
  USING (public.current_user_status() = 'active');

-- affiliates: only active admin/developer may create/update/delete.
CREATE POLICY affiliates_write_admin_dev ON public.affiliates
  FOR ALL
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND public.current_user_role() IN ('admin', 'developer')
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND public.current_user_role() IN ('admin', 'developer')
  );

-- campaigns: any active authenticated user may read.
CREATE POLICY campaigns_select_active ON public.campaigns
  FOR SELECT
  TO authenticated
  USING (public.current_user_status() = 'active');

-- campaigns: only active admin/developer may create/update/delete.
CREATE POLICY campaigns_write_admin_dev ON public.campaigns
  FOR ALL
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND public.current_user_role() IN ('admin', 'developer')
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND public.current_user_role() IN ('admin', 'developer')
  );

-- tracking_links: any active authenticated user may read.
CREATE POLICY tracking_links_select_active ON public.tracking_links
  FOR SELECT
  TO authenticated
  USING (public.current_user_status() = 'active');

-- tracking_links: only active admin/developer may create/update/delete.
CREATE POLICY tracking_links_write_admin_dev ON public.tracking_links
  FOR ALL
  TO authenticated
  USING (
    public.current_user_status() = 'active'
    AND public.current_user_role() IN ('admin', 'developer')
  )
  WITH CHECK (
    public.current_user_status() = 'active'
    AND public.current_user_role() IN ('admin', 'developer')
  );

-- ----------------------------------------------------------------------------
-- 9. Operator notes
-- ----------------------------------------------------------------------------
-- After running this migration (do NOT run it inside the application):
--   1. Apply 0001 first, then this migration, in the Supabase SQL editor or
--      via `supabase db push` / `supabase migration up`.
--   2. Codes are normalized to lowercase in the application before insert; the
--      CHECK constraint (^[a-z0-9][a-z0-9_-]*$) enforces it at the database too.
--   3. generated_url is built client-side and stored verbatim. It is NOT
--      recomputed when an affiliate/campaign code later changes, so historical
--      links remain stable.
--   4. The tracking pixel, click/visitor event collection, and GHL webhook
--      attribution are deliberately out of scope for this phase.
-- ============================================================================
