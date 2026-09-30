import { Badge } from "@/components/ui/badge";
import type { AffiliateStatus, CampaignStatus, TrackingLinkStatus } from "@/lib/phase2-types";

const TONE = {
  active: "default",
  inactive: "secondary",
  archived: "secondary",
  draft: "secondary",
  paused: "secondary",
} as const;

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AffiliateStatusBadge({ status }: { status: AffiliateStatus }) {
  return <Badge variant={TONE[status]}>{label(status)}</Badge>;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={TONE[status]}>{label(status)}</Badge>;
}

export function TrackingLinkStatusBadge({ status }: { status: TrackingLinkStatus }) {
  return <Badge variant={TONE[status]}>{label(status)}</Badge>;
}

/** Extract a short host from a URL for compact display; falls back to the raw value. */
export function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
