/**
 * Phase 2 validation schemas (Zod). Codes are normalized before validation so
 * the rules mirror the database CHECK constraints.
 */

import { z } from "zod";

import { normalizeCode } from "./codes";

const codeSchema = z
  .string()
  .min(1, "Required")
  .transform((v) => normalizeCode(v))
  .refine((v) => /^[a-z0-9][a-z0-9_-]*$/.test(v), {
    message: "Use only lowercase letters, numbers, hyphens, and underscores.",
  });

const httpUrlSchema = z
  .string()
  .min(1, "Required")
  .refine(
    (v) => {
      try {
        const u = new URL(v.trim());
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a valid http or https URL." },
  );

const optionalString = z
  .string()
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

const optionalUrl = z
  .string()
  .optional()
  .refine(
    (v) =>
      !v ||
      v.trim() === "" ||
      (() => {
        try {
          const u = new URL(v.trim());
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      })(),
    { message: "Enter a valid http or https URL." },
  );

export const affiliateSchema = z.object({
  affiliate_code: codeSchema,
  display_name: z.string().min(1, "Required"),
  legal_name: optionalString,
  email: optionalString,
  phone: optionalString,
  company_name: optionalString,
  system_user_id: optionalString,
  status: z.enum(["active", "inactive", "archived"]),
  notes: optionalString,
});

export const campaignSchema = z
  .object({
    campaign_code: codeSchema,
    name: z.string().min(1, "Required"),
    description: optionalString,
    destination_url: httpUrlSchema,
    status: z.enum(["draft", "active", "paused", "archived"]),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    default_utm_source: optionalString,
    default_utm_medium: optionalString,
    default_utm_campaign: optionalString,
  })
  .refine((d) => !d.start_date || !d.end_date || new Date(d.end_date) >= new Date(d.start_date), {
    message: "End date may not be earlier than the start date.",
    path: ["end_date"],
  });

export const trackingLinkSchema = z.object({
  tracking_code: codeSchema,
  name: z.string().min(1, "Required"),
  affiliate_id: z.string().min(1, "Select an affiliate"),
  campaign_id: z.string().min(1, "Select a campaign"),
  destination_url: httpUrlSchema,
  status: z.enum(["active", "inactive", "archived"]),
});

export type AffiliateFormValues = z.infer<typeof affiliateSchema>;
export type CampaignFormValues = z.infer<typeof campaignSchema>;
export type TrackingLinkFormValues = z.infer<typeof trackingLinkSchema>;

export { optionalUrl };
