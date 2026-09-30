import {
  Activity,
  ArrowUpRight,
  Eye,
  Link2,
  Megaphone,
  MousePointerClick,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { useOverviewCounts } from "@/lib/phase2-data";
import { EmptyState, PageHeader, StatCard } from "@/components/app-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/** Overview dashboard. Ships with placeholder statistics and clearly-labeled
 *  empty states — no fabricated production data in this foundation phase. */
export function OverviewPage() {
  const { branding, user } = useAuth();
  const { fetchCounts } = useOverviewCounts();
  const [counts, setCounts] = useState<{
    activeAffiliates: number;
    activeCampaigns: number;
  } | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setCountsLoading(true);
      try {
        const c = await fetchCounts();
        if (mounted) setCounts(c);
      } catch {
        // Degrade to empty states if the tables are not yet applied/accessible.
        if (mounted) setCounts(null);
      } finally {
        if (mounted) setCountsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchCounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}`}
        description={`High-level ${branding.platform_name} metrics and recent activity.`}
      />

      {/* Stat cards — placeholder values until real data exists. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Unique Visitors"
          value="—"
          icon={Eye}
          hint="No tracked visits yet"
          loading
        />
        <StatCard
          label="Identified Contacts"
          value="—"
          icon={UserCheck}
          hint="No contacts yet"
          loading
        />
        <StatCard
          label="Total Link Clicks"
          value="—"
          icon={MousePointerClick}
          hint="No clicks tracked yet"
          loading
        />
        <StatCard label="Conversions" value="—" icon={Target} hint="No conversions yet" loading />
        <StatCard
          label={`Active ${branding.affiliate_term}s`}
          value={counts ? String(counts.activeAffiliates) : "—"}
          icon={UserPlus}
          hint={
            counts && counts.activeAffiliates > 0
              ? `${counts.activeAffiliates} active`
              : "No active affiliates yet"
          }
          loading={countsLoading}
        />
        <StatCard
          label="Active Campaigns"
          value={counts ? String(counts.activeCampaigns) : "—"}
          icon={Megaphone}
          hint={
            counts && counts.activeCampaigns > 0
              ? `${counts.activeCampaigns} active`
              : "No active campaigns yet"
          }
          loading={countsLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" aria-hidden /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Tracked visits, link clicks, and identified contacts will appear here once tracking is enabled."
            />
          </CardContent>
        </Card>

        {/* Top Affiliates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden /> Top{" "}
              {branding.affiliate_term}s
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={UserPlus}
              title={`No ${branding.affiliate_term.toLowerCase()}s yet`}
              description="Your best-performing partners will be ranked here."
            />
          </CardContent>
        </Card>

        {/* Traffic Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden /> Traffic Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={TrendingUp}
              title="No traffic data yet"
              description="A time-series of unique visitors will chart here once events are collected."
            />
          </CardContent>
        </Card>

        {/* Top Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden /> Top Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Top campaigns by conversions will appear here."
            />
          </CardContent>
        </Card>

        {/* Attribution Overview */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Attribution Overview
              <Badge variant="outline" className="ml-auto gap-1 text-xs">
                <ArrowUpRight className="h-3 w-3" aria-hidden /> Coming in a later phase
              </Badge>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <EmptyState
              icon={Link2}
              title="Attribution not configured"
              description="Connecting anonymous activity to named contacts via webhooks is planned for a later phase. No data is shown yet."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
