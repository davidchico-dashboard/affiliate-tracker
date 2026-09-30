import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Affiliate Tracker" },
      { name: "description", content: "Affiliate and campaign reporting." },
      { property: "og:title", content: "Reports — Affiliate Tracker" },
      { property: "og:description", content: "Affiliate and campaign reporting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModulePage
      path="/reports"
      title="Reports"
      description="Affiliate and campaign reporting."
      icon={BarChart3}
      emptyTitle="No reports available yet"
      emptyDescription="Performance reports across affiliates and campaigns will be generated here once data collection is enabled."
    />
  ),
});
