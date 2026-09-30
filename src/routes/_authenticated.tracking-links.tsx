import { createFileRoute } from "@tanstack/react-router";

import { TrackingLinksPage } from "@/components/tracking-links-page";

export const Route = createFileRoute("/_authenticated/tracking-links")({
  head: () => ({
    meta: [
      { title: "Tracking Links — Affiliate Tracker" },
      { name: "description", content: "Create and manage trackable campaign links." },
      { property: "og:title", content: "Tracking Links — Affiliate Tracker" },
      { property: "og:description", content: "Create and manage trackable campaign links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <TrackingLinksPage />,
});
