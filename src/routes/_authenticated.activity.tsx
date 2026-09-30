import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Affiliate Tracker" },
      { name: "description", content: "Tracked website and funnel events." },
      { property: "og:title", content: "Activity — Affiliate Tracker" },
      { property: "og:description", content: "Tracked website and funnel events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModulePage
      path="/activity"
      title="Activity"
      description="Tracked website and funnel events."
      icon={Activity}
      emptyTitle="No activity tracked yet"
      emptyDescription="Visit events, link clicks, and funnel steps will appear here once tracking is enabled in a later phase."
    />
  ),
});
