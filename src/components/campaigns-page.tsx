import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Megaphone, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { canManageRecords } from "@/lib/phase2-permissions";
import { useCampaigns, type CampaignInput } from "@/lib/phase2-data";
import { campaignSchema, type CampaignFormValues } from "@/lib/phase2-schemas";
import type { Campaign, CampaignStatus } from "@/lib/phase2-types";
import { EmptyState, PageForbidden, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { CampaignStatusBadge, urlHost } from "@/components/phase2-status";

const STATUS_OPTIONS: (CampaignStatus | "all")[] = ["all", "draft", "active", "paused", "archived"];

export function CampaignsPage() {
  const { role } = useAuth();
  const canManage = canManageRecords(role);
  const { list, create, update } = useCampaigns();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [records, setRecords] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const reload = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await list({ search, status });
        setRecords(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load campaigns.");
      } finally {
        setLoading(false);
      }
    },
    [list, search, status],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  if (role !== "developer" && role !== "admin" && role !== "user") {
    return <PageForbidden feature="Campaigns" />;
  }

  return (
    <div>
      <PageHeader title="Campaigns" description="Affiliate campaigns and trackable destinations.">
        {canManage ? (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add campaign
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search campaigns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus | "all")}>
              <SelectTrigger className="w-full sm:w-44">
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
              icon={Megaphone}
              title="No campaigns yet"
              description="Create campaigns to group affiliates and trackable links."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Destination</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    {canManage ? (
                      <th className="py-2 pr-4 font-medium text-right">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {records.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {c.name}
                        {c.description ? (
                          <span className="block text-xs text-muted-foreground line-clamp-1">
                            {c.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{c.campaign_code}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {urlHost(c.destination_url)}
                      </td>
                      <td className="py-2 pr-4">
                        <CampaignStatusBadge status={c.status} />
                      </td>
                      {canManage ? (
                        <td className="py-2 pr-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(c);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                          </Button>
                          {c.status === "active" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await update(c.id, { status: "paused" });
                                toast.success("Campaign paused");
                                void reload();
                              }}
                            >
                              Pause
                            </Button>
                          ) : null}
                          {c.status === "paused" || c.status === "draft" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await update(c.id, { status: "active" });
                                toast.success("Campaign activated");
                                void reload();
                              }}
                            >
                              Activate
                            </Button>
                          ) : null}
                          {c.status !== "archived" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await update(c.id, { status: "archived" });
                                toast.success("Campaign archived");
                                void reload();
                              }}
                            >
                              Archive
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <CampaignDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSubmit={async (values) => {
            if (editing) {
              await update(editing.id, values as Partial<CampaignInput>);
            } else {
              await create(values as CampaignInput);
            }
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function CampaignDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Campaign | null;
  onSubmit: (values: CampaignFormValues) => Promise<void>;
}) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaign_code: "",
      name: "",
      description: null,
      destination_url: "",
      status: "draft",
      start_date: null,
      end_date: null,
      default_utm_source: null,
      default_utm_medium: null,
      default_utm_campaign: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              campaign_code: editing.campaign_code,
              name: editing.name,
              description: editing.description,
              destination_url: editing.destination_url,
              status: editing.status,
              start_date: editing.start_date,
              end_date: editing.end_date,
              default_utm_source: editing.default_utm_source,
              default_utm_medium: editing.default_utm_medium,
              default_utm_campaign: editing.default_utm_campaign,
            }
          : {
              campaign_code: "",
              name: "",
              description: null,
              destination_url: "",
              status: "draft",
              start_date: null,
              end_date: null,
              default_utm_source: null,
              default_utm_medium: null,
              default_utm_campaign: null,
            },
      );
    }
  }, [open, editing, form]);

  const [submitting, setSubmitting] = useState(false);

  async function submit(values: CampaignFormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
      toast.success(editing ? "Campaign updated" : "Campaign created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save campaign");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit campaign" : "Add campaign"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <Field label="Campaign name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} />
          </Field>
          <Field label="Campaign code" error={form.formState.errors.campaign_code?.message}>
            <Input
              {...form.register("campaign_code")}
              disabled={!!editing}
              placeholder="e.g. spring-sale"
            />
            {editing ? (
              <p className="text-xs text-muted-foreground">
                Codes cannot be changed after creation.
              </p>
            ) : null}
          </Field>
          <Field label="Description" error={form.formState.errors.description?.message}>
            <Textarea {...form.register("description")} rows={2} />
          </Field>
          <Field label="Destination URL" error={form.formState.errors.destination_url?.message}>
            <Input
              {...form.register("destination_url")}
              placeholder="https://example.com/landing"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date" error={form.formState.errors.start_date?.message}>
              <Input type="date" {...form.register("start_date")} />
            </Field>
            <Field label="End date" error={form.formState.errors.end_date?.message}>
              <Input type="date" {...form.register("end_date")} />
            </Field>
          </div>
          <Field label="Status" error={form.formState.errors.status?.message}>
            <Select
              value={form.watch("status")}
              onValueChange={(v) => form.setValue("status", v as CampaignStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["draft", "active", "paused", "archived"] as CampaignStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="Default UTM source"
              error={form.formState.errors.default_utm_source?.message}
            >
              <Input {...form.register("default_utm_source")} />
            </Field>
            <Field
              label="Default UTM medium"
              error={form.formState.errors.default_utm_medium?.message}
            >
              <Input {...form.register("default_utm_medium")} />
            </Field>
            <Field
              label="Default UTM campaign"
              error={form.formState.errors.default_utm_campaign?.message}
            >
              <Input {...form.register("default_utm_campaign")} />
            </Field>
          </div>
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
  error?: string;
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
