import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Link2, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { canManageRecords } from "@/lib/phase2-permissions";
import {
  useTrackingLinks,
  useAffiliates,
  useCampaigns,
  type TrackingLinkInput,
} from "@/lib/phase2-data";
import { trackingLinkSchema, type TrackingLinkFormValues } from "@/lib/phase2-schemas";
import { buildTrackingUrl, normalizeCode } from "@/lib/codes";
import type { TrackingLink, TrackingLinkStatus, Affiliate, Campaign } from "@/lib/phase2-types";
import { EmptyState, PageForbidden, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrackingLinkStatusBadge } from "@/components/phase2-status";

const STATUS_OPTIONS: (TrackingLinkStatus | "all")[] = ["all", "active", "inactive", "archived"];

export function TrackingLinksPage() {
  const { role } = useAuth();
  const canManage = canManageRecords(role);
  const { list, create, update } = useTrackingLinks();
  const { list: listAffiliates } = useAffiliates();
  const { list: listCampaigns } = useCampaigns();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TrackingLinkStatus | "all">("all");
  const [affiliateId, setAffiliateId] = useState<string>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [records, setRecords] = useState<TrackingLink[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrackingLink | null>(null);

  const reload = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const [rows, affs, camps] = await Promise.all([
          list({
            search,
            status,
            affiliateId: affiliateId === "all" ? undefined : affiliateId,
            campaignId: campaignId === "all" ? undefined : campaignId,
          }),
          listAffiliates({}),
          listCampaigns({}),
        ]);
        setRecords(rows);
        setAffiliates(affs);
        setCampaigns(camps);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tracking links.");
      } finally {
        setLoading(false);
      }
    },
    [list, listAffiliates, listCampaigns, search, status, affiliateId, campaignId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  if (role !== "developer" && role !== "admin" && role !== "user") {
    return <PageForbidden feature="Tracking Links" />;
  }

  const codeById = (id: string, type: "aff" | "camp") => {
    if (type === "aff") return affiliates.find((a) => a.id === id)?.affiliate_code ?? "—";
    return campaigns.find((c) => c.id === id)?.campaign_code ?? "—";
  };

  return (
    <div>
      <PageHeader title="Tracking Links" description="Create and manage trackable campaign links.">
        {canManage ? (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Create link
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search links…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={affiliateId} onValueChange={setAffiliateId}>
              <SelectTrigger>
                <SelectValue placeholder="Affiliate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All affiliates</SelectItem>
                {affiliates.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TrackingLinkStatus | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No tracking links yet"
              description="Generate trackable links tied to affiliates and campaigns."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Tracking code</th>
                    <th className="py-2 pr-4 font-medium">Affiliate</th>
                    <th className="py-2 pr-4 font-medium">Campaign</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-4 font-medium text-foreground">{t.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{t.tracking_code}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {codeById(t.affiliate_id, "aff")}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {codeById(t.campaign_id, "camp")}
                      </td>
                      <td className="py-2 pr-4">
                        <TrackingLinkStatusBadge status={t.status} />
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard?.writeText(t.generated_url);
                            toast.success("URL copied");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
                        </Button>
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(t);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <TrackingLinkDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          affiliates={affiliates}
          campaigns={campaigns}
          onSubmit={async (values) => {
            if (editing) {
              await update(editing.id, { name: values.name, status: values.status });
            } else {
              await create(values as TrackingLinkInput);
            }
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function TrackingLinkDialog({
  open,
  onOpenChange,
  editing,
  affiliates,
  campaigns,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TrackingLink | null;
  affiliates: Affiliate[];
  campaigns: Campaign[];
  onSubmit: (values: TrackingLinkFormValues) => Promise<void>;
}) {
  const form = useForm<TrackingLinkFormValues>({
    resolver: zodResolver(trackingLinkSchema),
    defaultValues: {
      tracking_code: "",
      name: "",
      affiliate_id: "",
      campaign_id: "",
      destination_url: "",
      status: "active",
    },
  });

  const watchAffiliateId = form.watch("affiliate_id");
  const watchCampaignId = form.watch("campaign_id");
  const watchDestination = form.watch("destination_url");
  const watchTrackingCode = form.watch("tracking_code");

  // Live preview of the generated URL before saving.
  const preview = useMemo(() => {
    const aff = affiliates.find((a) => a.id === watchAffiliateId);
    const camp = campaigns.find((c) => c.id === watchCampaignId);
    if (!aff || !camp || !watchDestination) return "";
    return buildTrackingUrl(
      watchDestination,
      aff.affiliate_code,
      camp.campaign_code,
      normalizeCode(watchTrackingCode),
    );
  }, [
    affiliates,
    campaigns,
    watchAffiliateId,
    watchCampaignId,
    watchDestination,
    watchTrackingCode,
  ]);

  // Default the destination URL from the selected campaign when creating.
  useEffect(() => {
    if (editing || !watchCampaignId) return;
    const camp = campaigns.find((c) => c.id === watchCampaignId);
    if (camp && !form.getValues("destination_url")) {
      form.setValue("destination_url", camp.destination_url);
    }
  }, [watchCampaignId, campaigns, editing, form]);

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              tracking_code: editing.tracking_code,
              name: editing.name,
              affiliate_id: editing.affiliate_id,
              campaign_id: editing.campaign_id,
              destination_url: editing.destination_url,
              status: editing.status,
            }
          : {
              tracking_code: "",
              name: "",
              affiliate_id: "",
              campaign_id: "",
              destination_url: "",
              status: "active",
            },
      );
    }
  }, [open, editing, form]);

  const [submitting, setSubmitting] = useState(false);

  async function submit(values: TrackingLinkFormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
      toast.success(editing ? "Tracking link updated" : "Tracking link created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save tracking link");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit tracking link" : "Create tracking link"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Tracking code" error={form.formState.errors.tracking_code?.message}>
            <Input
              {...form.register("tracking_code")}
              disabled={!!editing}
              placeholder="e.g. tl-abc123"
            />
            {editing ? (
              <p className="text-xs text-muted-foreground">
                Codes cannot be changed after creation.
              </p>
            ) : null}
          </Field>
          <Field label="Affiliate" error={form.formState.errors.affiliate_id?.message}>
            <Select
              value={watchAffiliateId}
              onValueChange={(v) => form.setValue("affiliate_id", v)}
              disabled={!!editing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select affiliate" />
              </SelectTrigger>
              <SelectContent>
                {affiliates.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Campaign" error={form.formState.errors.campaign_id?.message}>
            <Select
              value={watchCampaignId}
              onValueChange={(v) => form.setValue("campaign_id", v)}
              disabled={!!editing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Destination URL" error={form.formState.errors.destination_url?.message}>
            <Input
              {...form.register("destination_url")}
              disabled={!!editing}
              placeholder="https://example.com/landing"
            />
            {!editing ? (
              <p className="text-xs text-muted-foreground">
                Defaults to the campaign destination; override before creating.
              </p>
            ) : null}
          </Field>
          <Field label="Status" error={form.formState.errors.status?.message}>
            <Select
              value={form.watch("status")}
              onValueChange={(v) => form.setValue("status", v as TrackingLinkStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["active", "inactive", "archived"] as TrackingLinkStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {preview ? (
            <div className="space-y-1.5">
              <Label>Generated URL preview</Label>
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
                <code className="break-all text-xs text-foreground">{preview}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    void navigator.clipboard?.writeText(preview);
                    toast.success("Preview URL copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
