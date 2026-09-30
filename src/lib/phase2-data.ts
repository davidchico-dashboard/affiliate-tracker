/**
 * Phase 2 data access layer.
 *
 * All reads/writes go through the runtime-configured browser Supabase client
 * and are enforced by Row Level Security. Role values are never trusted from
 * the client; the database is the authority. created_by references the
 * system_users profile primary key, not the Supabase Auth user ID.
 */

import { getSupabaseClient } from "./supabase";
import { useAuth } from "./auth-context";
import { useCallback } from "react";
import type {
  Affiliate,
  Campaign,
  TrackingLink,
  AffiliateStatus,
  CampaignStatus,
  TrackingLinkStatus,
} from "./phase2-types";
import { buildTrackingUrl, isValidHttpUrl, normalizeCode, isValidCode } from "./codes";

export interface AffiliateInput {
  affiliate_code: string;
  display_name: string;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  system_user_id?: string | null;
  status?: AffiliateStatus;
  notes?: string | null;
}

export interface CampaignInput {
  campaign_code: string;
  name: string;
  description?: string | null;
  destination_url: string;
  status?: CampaignStatus;
  start_date?: string | null;
  end_date?: string | null;
  default_utm_source?: string | null;
  default_utm_medium?: string | null;
  default_utm_campaign?: string | null;
}

export interface TrackingLinkInput {
  tracking_code: string;
  name: string;
  affiliate_id: string;
  campaign_id: string;
  destination_url: string;
  status?: TrackingLinkStatus;
}

export class CodeFormatError extends Error {
  constructor(field: string) {
    super(
      `${field} must contain only lowercase letters, numbers, hyphens, and underscores, and may not be empty.`,
    );
    this.name = "CodeFormatError";
  }
}

export class UrlFormatError extends Error {
  constructor(field = "destination_url") {
    super(`${field} must be a valid absolute http or https URL.`);
    this.name = "UrlFormatError";
  }
}

export class DateRangeError extends Error {
  constructor() {
    super("End date may not be earlier than the start date.");
    this.name = "DateRangeError";
  }
}

function client() {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function stampCreatedBy(
  body: Record<string, unknown>,
  profileId: string | null,
): Record<string, unknown> {
  if (profileId) body["created_by"] = profileId;
  return body;
}

function humanizeError(err: { message: string } | null): string {
  if (!err) return "Something went wrong. Please try again.";
  const m = err.message.toLowerCase();
  if (m.includes("duplicate") || m.includes("unique") || m.includes("23505")) {
    return "A record with that code already exists. Choose a unique code.";
  }
  if (m.includes("violates") || m.includes("check constraint")) {
    return "One or more fields failed validation. Check codes, URLs, and dates.";
  }
  if (m.includes("permission") || m.includes("rls") || m.includes("policy")) {
    return "You do not have permission to perform this action.";
  }
  return err.message;
}

export function useAffiliates() {
  const { user } = useAuth();
  const profileId = user?.id ?? null;

  const list = useCallback(async (opts?: { search?: string; status?: AffiliateStatus | "all" }) => {
    const sb = client();
    let q = sb.from("affiliates").select("*").order("created_at", { ascending: false });
    if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
    if (opts?.search) {
      const s = opts.search.trim();
      q = q.or(
        `display_name.ilike.%${s}%,email.ilike.%${s}%,company_name.ilike.%${s}%,affiliate_code.ilike.%${s}%`,
      );
    }
    const { data, error } = await q;
    if (error) throw new Error(humanizeError(error));
    return (data as Affiliate[]) ?? [];
  }, []);

  const create = useCallback(
    async (input: AffiliateInput) => {
      const code = normalizeCode(input.affiliate_code);
      if (!isValidCode(code)) throw new CodeFormatError("affiliate_code");
      const sb = client();
      const body = stampCreatedBy(
        {
          affiliate_code: code,
          display_name: input.display_name.trim(),
          legal_name: input.legal_name ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          company_name: input.company_name ?? null,
          system_user_id: input.system_user_id ?? null,
          status: input.status ?? "active",
          notes: input.notes ?? null,
        },
        profileId,
      );
      const { data, error } = await sb.from("affiliates").insert(body).select().maybeSingle();
      if (error) throw new Error(humanizeError(error));
      return data as Affiliate | null;
    },
    [profileId],
  );

  const update = useCallback(async (id: string, patch: Partial<AffiliateInput>) => {
    const sb = client();
    const body: Record<string, unknown> = {};
    if (patch.display_name !== undefined) body["display_name"] = patch.display_name.trim();
    if (patch.legal_name !== undefined) body["legal_name"] = patch.legal_name;
    if (patch.email !== undefined) body["email"] = patch.email;
    if (patch.phone !== undefined) body["phone"] = patch.phone;
    if (patch.company_name !== undefined) body["company_name"] = patch.company_name;
    if (patch.system_user_id !== undefined) body["system_user_id"] = patch.system_user_id;
    if (patch.status !== undefined) body["status"] = patch.status;
    if (patch.notes !== undefined) body["notes"] = patch.notes;
    const { data, error } = await sb
      .from("affiliates")
      .update(body)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new Error(humanizeError(error));
    return data as Affiliate | null;
  }, []);

  return { list, create, update };
}

export function useCampaigns() {
  const { user } = useAuth();
  const profileId = user?.id ?? null;

  const list = useCallback(async (opts?: { search?: string; status?: CampaignStatus | "all" }) => {
    const sb = client();
    let q = sb.from("campaigns").select("*").order("created_at", { ascending: false });
    if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
    if (opts?.search) {
      const s = opts.search.trim();
      q = q.or(`name.ilike.%${s}%,campaign_code.ilike.%${s}%,description.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw new Error(humanizeError(error));
    return (data as Campaign[]) ?? [];
  }, []);

  const create = useCallback(
    async (input: CampaignInput) => {
      const code = normalizeCode(input.campaign_code);
      if (!isValidCode(code)) throw new CodeFormatError("campaign_code");
      if (!isValidHttpUrl(input.destination_url)) throw new UrlFormatError("destination_url");
      if (
        input.start_date &&
        input.end_date &&
        new Date(input.end_date) < new Date(input.start_date)
      ) {
        throw new DateRangeError();
      }
      const sb = client();
      const body = stampCreatedBy(
        {
          campaign_code: code,
          name: input.name.trim(),
          description: input.description ?? null,
          destination_url: input.destination_url.trim(),
          status: input.status ?? "draft",
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          default_utm_source: input.default_utm_source ?? null,
          default_utm_medium: input.default_utm_medium ?? null,
          default_utm_campaign: input.default_utm_campaign ?? null,
        },
        profileId,
      );
      const { data, error } = await sb.from("campaigns").insert(body).select().maybeSingle();
      if (error) throw new Error(humanizeError(error));
      return data as Campaign | null;
    },
    [profileId],
  );

  const update = useCallback(async (id: string, patch: Partial<CampaignInput>) => {
    if (
      patch.start_date !== undefined &&
      patch.end_date !== undefined &&
      patch.start_date &&
      patch.end_date &&
      new Date(patch.end_date) < new Date(patch.start_date)
    ) {
      throw new DateRangeError();
    }
    const sb = client();
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body["name"] = patch.name.trim();
    if (patch.description !== undefined) body["description"] = patch.description;
    if (patch.destination_url !== undefined) {
      if (!isValidHttpUrl(patch.destination_url)) throw new UrlFormatError("destination_url");
      body["destination_url"] = patch.destination_url.trim();
    }
    if (patch.status !== undefined) body["status"] = patch.status;
    if (patch.start_date !== undefined) body["start_date"] = patch.start_date;
    if (patch.end_date !== undefined) body["end_date"] = patch.end_date;
    if (patch.default_utm_source !== undefined)
      body["default_utm_source"] = patch.default_utm_source;
    if (patch.default_utm_medium !== undefined)
      body["default_utm_medium"] = patch.default_utm_medium;
    if (patch.default_utm_campaign !== undefined)
      body["default_utm_campaign"] = patch.default_utm_campaign;
    const { data, error } = await sb
      .from("campaigns")
      .update(body)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new Error(humanizeError(error));
    return data as Campaign | null;
  }, []);

  return { list, create, update };
}

export function useTrackingLinks() {
  const { user } = useAuth();
  const profileId = user?.id ?? null;

  const list = useCallback(
    async (opts?: {
      search?: string;
      status?: TrackingLinkStatus | "all";
      affiliateId?: string | undefined;
      campaignId?: string | undefined;
    }) => {
      const sb = client();
      let q = sb.from("tracking_links").select("*").order("created_at", { ascending: false });
      if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
      if (opts?.affiliateId) q = q.eq("affiliate_id", opts.affiliateId);
      if (opts?.campaignId) q = q.eq("campaign_id", opts.campaignId);
      if (opts?.search) {
        const s = opts.search.trim();
        q = q.or(`name.ilike.%${s}%,tracking_code.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw new Error(humanizeError(error));
      return (
        (data as (TrackingLink & {
          affiliate_code?: string | null;
          campaign_code?: string | null;
        })[]) ?? []
      );
    },
    [],
  );

  const create = useCallback(
    async (input: TrackingLinkInput) => {
      const code = normalizeCode(input.tracking_code);
      if (!isValidCode(code)) throw new CodeFormatError("tracking_code");
      if (!isValidHttpUrl(input.destination_url)) throw new UrlFormatError("destination_url");
      const sb = client();
      const { data: aff, error: affErr } = await sb
        .from("affiliates")
        .select("affiliate_code")
        .eq("id", input.affiliate_id)
        .maybeSingle();
      if (affErr) throw new Error(humanizeErrorError(affErr));
      const { data: camp, error: campErr } = await sb
        .from("campaigns")
        .select("campaign_code")
        .eq("id", input.campaign_id)
        .maybeSingle();
      if (campErr) throw new Error(humanizeErrorError(campErr));
      const affiliateCode = (aff as { affiliate_code: string } | null)?.affiliate_code;
      const campaignCode = (camp as { campaign_code: string } | null)?.campaign_code;
      if (!affiliateCode) throw new Error("Affiliate not found or not accessible.");
      if (!campaignCode) throw new Error("Campaign not found or not accessible.");
      const generated = buildTrackingUrl(input.destination_url, affiliateCode, campaignCode, code);
      const body = stampCreatedBy(
        {
          tracking_code: code,
          name: input.name.trim(),
          affiliate_id: input.affiliate_id,
          campaign_id: input.campaign_id,
          destination_url: input.destination_url.trim(),
          generated_url: generated,
          status: input.status ?? "active",
        },
        profileId,
      );
      const { data, error } = await sb.from("tracking_links").insert(body).select().maybeSingle();
      if (error) throw new Error(humanizeError(error));
      return data as TrackingLink | null;
    },
    [profileId],
  );

  const update = useCallback(
    async (id: string, patch: { name?: string; status?: TrackingLinkStatus }) => {
      const sb = client();
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body["name"] = patch.name.trim();
      if (patch.status !== undefined) body["status"] = patch.status;
      const { data, error } = await sb
        .from("tracking_links")
        .update(body)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw new Error(humanizeError(error));
      return data as TrackingLink | null;
    },
    [],
  );

  return { list, create, update };
}

export function useOverviewCounts() {
  const fetchCounts = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) return { activeAffiliates: 0, activeCampaigns: 0 };
    const [aff, camp] = await Promise.all([
      sb.from("affiliates").select("id", { count: "exact", head: true }).eq("status", "active"),
      sb.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);
    return {
      activeAffiliates: aff.count ?? 0,
      activeCampaigns: camp.count ?? 0,
    };
  }, []);
  return { fetchCounts };
}

function humanizeErrorError(err: { message: string } | null): string {
  return humanizeError(err);
}
