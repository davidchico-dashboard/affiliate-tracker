import { createFileRoute } from "@tanstack/react-router";

import { AffiliatesPage } from "@/components/affiliates-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/affiliates")({
  head: () => ({
    meta: [
      { title: "Affiliates — Affiliate Tracker" },
      { name: "description", content: "Manage affiliates, referral partners, agents and reps." },
      { property: "og:title", content: "Affiliates — Affiliate Tracker" },
      {
        property: "og:description",
        content: "Manage affiliates, referral partners, agents and reps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AffiliatesRoute,
});

function AffiliatesRoute() {
  const { branding } = useAuth();
  return <AffiliatesPage key={branding.affiliate_term} />;
}
