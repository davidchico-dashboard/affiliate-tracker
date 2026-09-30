import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Pencil, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { canManageRecords } from "@/lib/phase2-permissions";
import { useAffiliates, type AffiliateInput } from "@/lib/phase2-data";
import { affiliateSchema, type AffiliateFormValues } from "@/lib/phase2-schemas";
import type { Affiliate, AffiliateStatus } from "@/lib/phase2-types";
import { EmptyState, PageForbidden, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AffiliateStatusBadge } from "@/components/phase2-status";

const STATUS_OPTIONS: (AffiliateStatus | "all")[] = ["all", "active", "inactive", "archived"];

export function AffiliatesPage() {
  const { role, branding } = useAuth();
  const affiliateTerm = branding.affiliate_term;
  const lower = affiliateTerm.toLowerCase();

  const canManage = canManageRecords(role);
  const { list, create, update } = useAffiliates();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AffiliateStatus | "all">("all");
  const [records, setRecords] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [detail, setDetail] = useState<Affiliate | null>(null);

  const reload = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await list({ search, status });
        setRecords(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load affiliates.");
      } finally {
        setLoading(false);
      }
    },
    [list, search, status],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!canManageRecords(role) && role !== "user") {
    return <PageForbidden feature={`${affiliateTerm}s`} />;
  }

  return (
    <div>
      <PageHeader
        title={`${affiliateTerm}s`}
        description={`Manage ${lower}s, referral partners, agents, and reps.`}
      >
        {canManage ? (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add {affiliateTerm}
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
                placeholder={`Search ${lower}s…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as AffiliateStatus | "all")}>
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
              icon={UserPlus}
              title={`No ${lower}s yet`}
              description={`Add ${lower}s to assign campaigns and trackable links.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    {canManage ? (
                      <th className="py-2 pr-4 font-medium text-right">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {records.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                      onClick={() => setDetail(a)}
                    >
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {a.display_name}
                        {a.company_name ? (
                          <span className="block text-xs text-muted-foreground">
                            {a.company_name}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard?.writeText(a.affiliate_code);
                            toast.success("Code copied");
                          }}
                        >
                          <Copy className="h-3 w-3" aria-hidden /> {a.affiliate_code}
                        </button>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{a.email ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <AffiliateStatusBadge status={a.status} />
                      </td>
                      {canManage ? (
                        <td className="py-2 pr-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(a);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                          </Button>
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
        <AffiliateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSubmit={async (values) => {
            if (editing) {
              await update(editing.id, values as Partial<AffiliateInput>);
            } else {
              await create(values as AffiliateInput);
            }
            await reload();
          }}
        />
      ) : null}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.display_name}</SheetTitle>
          </SheetHeader>
          {detail ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <AffiliateStatusBadge status={detail.status} />
              </div>
              <DetailRow label="Code" value={detail.affiliate_code} mono />
              <DetailRow label="Legal name" value={detail.legal_name} />
              <DetailRow label="Email" value={detail.email} />
              <DetailRow label="Phone" value={detail.phone} />
              <DetailRow label="Company" value={detail.company_name} />
              <DetailRow label="Linked user" value={detail.system_user_id ? "Linked" : "None"} />
              {detail.notes ? (
                <div>
                  <p className="text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              ) : null}
              {canManage && detail.status !== "archived" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    await update(detail.id, { status: "archived" });
                    toast.success(`${affiliateTerm} archived`);
                    setDetail(null);
                    await reload();
                  }}
                >
                  Archive {affiliateTerm}
                </Button>
              ) : null}
              {canManage && detail.status === "archived" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    await update(detail.id, { status: "active" });
                    toast.success(`${affiliateTerm} reactivated`);
                    setDetail(null);
                    await reload();
                  }}
                >
                  Reactivate {affiliateTerm}
                </Button>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value || "—"}</span>
    </div>
  );
}

function AffiliateDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Affiliate | null;
  onSubmit: (values: AffiliateFormValues) => Promise<void>;
}) {
  const form = useForm<AffiliateFormValues>({
    resolver: zodResolver(affiliateSchema),
    defaultValues: {
      affiliate_code: "",
      display_name: "",
      legal_name: null,
      email: null,
      phone: null,
      company_name: null,
      system_user_id: null,
      status: "active",
      notes: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              affiliate_code: editing.affiliate_code,
              display_name: editing.display_name,
              legal_name: editing.legal_name,
              email: editing.email,
              phone: editing.phone,
              company_name: editing.company_name,
              system_user_id: editing.system_user_id,
              status: editing.status,
              notes: editing.notes,
            }
          : {
              affiliate_code: "",
              display_name: "",
              legal_name: null,
              email: null,
              phone: null,
              company_name: null,
              system_user_id: null,
              status: "active",
              notes: null,
            },
      );
    }
  }, [open, editing, form]);

  const [submitting, setSubmitting] = useState(false);

  async function submit(values: AffiliateFormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
      toast.success(editing ? "Affiliate updated" : "Affiliate created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save affiliate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit affiliate" : "Add affiliate"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <Field label="Display name" error={form.formState.errors.display_name?.message}>
            <Input {...form.register("display_name")} />
          </Field>
          <Field label="Affiliate code" error={form.formState.errors.affiliate_code?.message}>
            <Input
              {...form.register("affiliate_code")}
              disabled={!!editing}
              placeholder="e.g. jdoe"
            />
            {editing ? (
              <p className="text-xs text-muted-foreground">
                Codes cannot be changed after creation.
              </p>
            ) : null}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Legal name" error={form.formState.errors.legal_name?.message}>
              <Input {...form.register("legal_name")} />
            </Field>
            <Field label="Company" error={form.formState.errors.company_name?.message}>
              <Input {...form.register("company_name")} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label="Phone" error={form.formState.errors.phone?.message}>
              <Input {...form.register("phone")} />
            </Field>
          </div>
          <Field label="Status" error={form.formState.errors.status?.message}>
            <Select
              value={form.watch("status")}
              onValueChange={(v) => form.setValue("status", v as AffiliateStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["active", "inactive", "archived"] as AffiliateStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes" error={form.formState.errors.notes?.message}>
            <Textarea {...form.register("notes")} rows={3} />
          </Field>
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
