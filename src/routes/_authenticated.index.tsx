import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "@/components/overview-page";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Overview — Affiliate Tracker" },
      {
        name: "description",
        content: "High-level affiliate marketing metrics and recent activity.",
      },
      { property: "og:title", content: "Overview — Affiliate Tracker" },
      {
        property: "og:description",
        content: "High-level affiliate marketing metrics and recent activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});
