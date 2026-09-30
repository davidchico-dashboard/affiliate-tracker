import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/websites")({
  head: () => ({
    meta: [
      { title: "Websites — Affiliate Tracker" },
      { name: "description", content: "Sites and funnels being tracked." },
      { property: "og:title", content: "Websites — Affiliate Tracker" },
      { property: "og:description", content: "Sites and funnels being tracked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModulePage
      path="/websites"
      title="Websites"
      description="Sites and funnels being tracked."
      icon={Globe}
      emptyTitle="No websites tracked yet"
      emptyDescription="Register sites and funnels to track visits and attribute them to affiliates in a later phase."
    />
  ),
});
