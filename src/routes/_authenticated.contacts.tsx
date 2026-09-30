import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { ModulePage } from "@/components/module-page";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — Affiliate Tracker" },
      { name: "description", content: "Identified leads and contacts." },
      { property: "og:title", content: "Contacts — Affiliate Tracker" },
      { property: "og:description", content: "Identified leads and contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const { branding } = useAuth();
  return (
    <ModulePage
      path="/contacts"
      title="Contacts"
      description="Identified leads and contacts."
      icon={Users}
      emptyTitle="No contacts yet"
      emptyDescription={`Identified ${branding.user_term.toLowerCase()}s and leads will appear here once attribution is connected in a later phase.`}
    />
  );
}
