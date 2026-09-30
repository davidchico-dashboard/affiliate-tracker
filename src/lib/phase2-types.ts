/**
 * Phase 2 domain types: affiliates, campaigns, tracking links.
 *
 * These describe rows read through RLS. Authorization is NEVER derived from a
 * client-supplied value; the database enforces the real permissions.
 */

import type { SystemRole, UserStatus } from "./types";

export type AffiliateStatus = "active" | "inactive" | "archived";
export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type TrackingLinkStatus = "active" | "inactive" | "archived";

export interface Affiliate {
  id: string;
  affiliate_code: string;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  system_user_id: string | null;
  status: AffiliateStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined system user email when linked (read via the affiliate detail). */
  system_user_email?: string | null;
}

export interface Campaign {
  id: string;
  campaign_code: string;
  name: string;
  description: string | null;
  destination_url: string;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  default_utm_source: string | null;
  default_utm_medium: string | null;
  default_utm_campaign: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackingLink {
  id: string;
  tracking_code: string;
  name: string;
  affiliate_id: string;
  campaign_id: string;
  destination_url: string;
  generated_url: string;
  status: TrackingLinkStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined affiliate code (for display). */
  affiliate_code?: string | null;
  /** Joined campaign code (for display). */
  campaign_code?: string | null;
}

/** Counts returned for the overview stat cards. */
export interface OverviewCounts {
  activeAffiliates: number;
  activeCampaigns: number;
}

/** Re-export role/status so callers can import domain + auth types together. */
export type { SystemRole, UserStatus };
