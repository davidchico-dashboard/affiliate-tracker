import { createFileRoute } from "@tanstack/react-router";

import { CampaignsPage } from "@/components/campaigns-page";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — Affiliate Tracker" },
      { name: "description", content: "Affiliate campaigns and their performance." },
      { property: "og:title", content: "Campaigns — Affiliate Tracker" },
      { property: "og:description", content: "Affiliate campaigns and their performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <CampaignsPage />,
});
