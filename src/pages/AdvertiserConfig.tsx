import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { subHours, subMinutes } from "date-fns";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useAffiliates } from "@/hooks/useAffiliates";
import {
  useDistributionSettings,
  useUpsertDistributionSetting,
} from "@/hooks/useDistributionSettings";
import { useTodayDistributionCounts } from "@/hooks/useTodayDistributionCounts";
import { useRecentDistributionStats } from "@/hooks/useRecentDistributionStats";
import { AdvertiserConfigPanel } from "@/components/distribution/AdvertiserConfigPanel";
import { ConflictLinterBadge, ConflictLinterSheet, computeWarnings } from "@/components/distribution/ConflictLinterSheet";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { summarizeWorkingHours } from "@/lib/scheduleUtils";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDot,
  Search,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Zap,
} from "lucide-react";

// ─── throughput query ────────────────────────────────────────────────────────

interface AdvStats {
  sent24: number;
  failed24: number;
  sentHour: number;
}

interface ThroughputData {
  byAdv: Record<string, AdvStats>;
  totalSent: number;
  totalFailed: number;
  rejectionRate: number;
  lpm: number;
}

function useThroughput() {
  const { autoRefreshInterval } = useCRMSettings();
  const refetchMs = autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : false;

  return useQuery<ThroughputData>({
    queryKey: ["adv-config-throughput"],
    queryFn: async () => {
      const now = new Date();
      const dayAgo = subHours(now, 24).toISOString();
      const hourAgo = subHours(now, 1).toISOString();
      const fiveMinAgo = subMinutes(now, 5).toISOString();

      const [res24h, resHour, resFive] = await Promise.all([
        supabase
          .from("lead_distributions")
          .select("advertiser_id, status")
          .gte("created_at", dayAgo)
          .limit(10000),
        supabase
          .from("lead_distributions")
          .select("advertiser_id, status")
          .gte("created_at", hourAgo)
          .limit(10000),
        supabase
          .from("lead_distributions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", fiveMinAgo),
      ]);

      const byAdv: Record<string, AdvStats> = {};
      for (const d of res24h.data || []) {
        const a = (byAdv[d.advertiser_id] ??= { sent24: 0, failed24: 0, sentHour: 0 });
        if (d.status === "sent") a.sent24++;
        else if (d.status === "failed") a.failed24++;
      }
      for (const d of resHour.data || []) {
        const a = (byAdv[d.advertiser_id] ??= { sent24: 0, failed24: 0, sentHour: 0 });
        if (d.status === "sent") a.sentHour++;
      }

      const totalSent = Object.values(byAdv).reduce((s, v) => s + v.sent24, 0);
      const totalFailed = Object.values(byAdv).reduce((s, v) => s + v.failed24, 0);
      const totalAll = totalSent + totalFailed;
      const rejectionRate = totalAll ? (totalFailed / totalAll) * 100 : 0;
      const lpm = (resFive.count ?? 0) / 5;

      return { byAdv, totalSent, totalFailed, rejectionRate, lpm };
    },
    refetchInterval: refetchMs,
  });
}

// Recent failures for one advertiser — fetched on demand (only when its
// "Failing" badge is clicked), not bundled into useThroughput() above which
// stays lean since it already drives every card on the page.
function useAdvertiserFailures(advertiserId: string | null) {
  return useQuery({
    queryKey: ["adv-failures", advertiserId],
    queryFn: async () => {
      const dayAgo = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from("lead_distributions")
        .select("id, created_at, response, request_url")
        .eq("advertiser_id", advertiserId as string)
        .eq("status", "failed")
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!advertiserId,
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type StatusTone = "ok" | "danger" | "idle" | "muted";

function statusFor(
  adv: { is_active: boolean; id: string },
  stats?: AdvStats
): { tone: StatusTone; label: string } {
  if (!adv.is_active) return { tone: "muted", label: "Paused" };
  if (stats && stats.failed24 > stats.sent24 && stats.failed24 > 5)
    return { tone: "danger", label: "Failing" };
  if (stats && stats.sent24 > 0) return { tone: "ok", label: "Live" };
  return { tone: "idle", label: "Idle" };
}

const TONE_BAR: Record<StatusTone, string> = {
  ok: "bg-emerald-500",
  danger: "bg-red-500",
  idle: "bg-amber-500",
  muted: "bg-muted-foreground/40",
};

const TONE_BADGE: Record<StatusTone, string> = {
  ok: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  danger: "border-red-500/30 text-red-600 dark:text-red-400",
  idle: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
};

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiTile({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent: "amber" | "emerald" | "red" | "indigo";
}) {
  const map = {
    amber: "from-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "from-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    red: "from-red-500/10 text-red-600 dark:text-red-400",
    indigo: "from-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  } as const;
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", map[accent])} />
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          <span className={cn("rounded-md p-1.5", map[accent].split(" ").slice(1).join(" "))}>
            {icon}
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AdvertiserConfig() {
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string | null>(null);
  const [issuesAdvertiserId, setIssuesAdvertiserId] = useState<string | null>(null);
  const [issuesSummaryOpen, setIssuesSummaryOpen] = useState(false);
  const [linterOpen, setLinterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();

  const { data: advertisers, isLoading: loadingAdvertisers } = useAdvertisers();
  const { data: affiliates, isLoading: loadingAffiliates } = useAffiliates();
  const { data: settings, isLoading: loadingSettings } = useDistributionSettings();
  const { data: todayCounts = {} } = useTodayDistributionCounts();
  const { data: avgStats = {} } = useRecentDistributionStats(7);
  const { data: throughput, isLoading: loadingThroughput } = useThroughput();

  const upsertSetting = useUpsertDistributionSetting();

  // ── derived ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = advertisers || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => statusFor(a, throughput?.byAdv[a.id]).tone === statusFilter);
    }
    return list;
  }, [advertisers, search, statusFilter, throughput]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const issues = useMemo(() => {
    const list: string[] = [];
    (advertisers || []).forEach((a) => {
      const s = throughput?.byAdv[a.id];
      const cap = (settings || []).find((x) => x.advertiser_id === a.id)?.default_daily_cap;
      if (!a.is_active) return;
      if (cap && (s?.sent24 || 0) >= cap) list.push(`${a.name} daily cap reached`);
      else if (cap && (s?.sent24 || 0) / cap >= 0.9) list.push(`${a.name} >90% daily cap`);
    });
    return list;
  }, [advertisers, settings, throughput]);

  const linterWarningsCount = useMemo(
    () => computeWarnings(advertisers || [], (settings as any[]) || [], avgStats).length,
    [advertisers, settings, avgStats]
  );

  const selectedAdvertiser = (advertisers || []).find((a) => a.id === selectedAdvertiserId) ?? null;
  const issuesAdvertiser = (advertisers || []).find((a) => a.id === issuesAdvertiserId) ?? null;
  const { data: advertiserFailures, isLoading: loadingFailures } = useAdvertiserFailures(issuesAdvertiserId);
  const selectedSetting = (settings || []).find((s) => s.advertiser_id === selectedAdvertiserId) ?? null;

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleSaveSetting = (updates: { advertiser_id: string; [key: string]: unknown }) => {
    upsertSetting.mutate({
      advertiser_id: updates.advertiser_id,
      is_active: (updates.is_active as boolean) ?? false,
      priority: (updates.priority as number) || 1,
      countries: (updates.countries as string[] | null)?.length ? (updates.countries as string[]) : null,
      affiliates: (updates.affiliates as string[] | null)?.length ? (updates.affiliates as string[]) : null,
      base_weight: (updates.base_weight as number) || 100,
      start_time: (updates.start_time as string) || "00:00",
      end_time: (updates.end_time as string) || "23:59",
      default_daily_cap: (updates.default_daily_cap as number) || 100,
      default_hourly_cap: (updates.default_hourly_cap as number | null) ?? null,
      weekly_schedule: updates.weekly_schedule,
      overflow_option: (updates.overflow_option as string) || "next_advertiser",
      timezone: (updates.timezone as string) || "UTC",
    } as any);
  };

  const handleCardClick = (id: string) => {
    setSelectedAdvertiserId(id);
  };

  // ── loading ───────────────────────────────────────────────────────────────

  if (loadingAdvertisers || loadingSettings || loadingAffiliates) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <ConflictLinterSheet
        open={linterOpen}
        onOpenChange={setLinterOpen}
        onSelectAdvertiser={(id) => setSelectedAdvertiserId(id)}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sliders className="h-7 w-7" />
              Advertiser Config
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Click an advertiser card to configure caps, schedule and delivery settings.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Issues / all-clear badge */}
            <button
              type="button"
              onClick={() => issues.length > 0 && setIssuesSummaryOpen(true)}
              disabled={issues.length === 0}
              className={cn(issues.length > 0 && "cursor-pointer")}
            >
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 px-2.5 py-1 font-medium",
                  issues.length === 0
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                )}
              >
                {issues.length === 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {issues.length === 0 ? "All systems normal" : `${issues.length} issues`}
              </Badge>
            </button>

            {/* Conflict linter badge (detailed) */}
            {linterWarningsCount > 0 && (
              <button type="button" onClick={() => setLinterOpen(true)} className="cursor-pointer">
                <ConflictLinterBadge
                  advertisers={advertisers || []}
                  settings={settings as any[] || []}
                  avgStats={avgStats}
                />
              </button>
            )}

            <Badge variant="secondary" className="gap-1.5">
              <Activity className="h-3 w-3 animate-pulse text-emerald-500" />
              Live
            </Badge>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            icon={<Zap className="h-4 w-4" />}
            label="Leads / min"
            value={loadingThroughput ? "—" : (throughput?.lpm.toFixed(1) ?? "0")}
            hint="rolling 5-minute average"
            accent="amber"
          />
          <KpiTile
            icon={<TrendingUp className="h-4 w-4" />}
            label="Accepted (24h)"
            value={loadingThroughput ? "—" : (throughput?.totalSent ?? 0).toLocaleString()}
            hint="successful deliveries"
            accent="emerald"
          />
          <KpiTile
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Rejection rate"
            value={loadingThroughput ? "—" : `${(throughput?.rejectionRate ?? 0).toFixed(1)}%`}
            hint={`${throughput?.totalFailed ?? 0} failed in 24h`}
            accent={(throughput?.rejectionRate ?? 0) > 20 ? "red" : (throughput?.rejectionRate ?? 0) > 5 ? "amber" : "emerald"}
          />
          <KpiTile
            icon={<Building2 className="h-4 w-4" />}
            label="Active advertisers"
            value={(advertisers?.filter((a) => a.is_active).length ?? 0).toString()}
            hint={`${advertisers?.length ?? 0} total configured`}
            accent="indigo"
          />
        </div>

        {/* Search + status filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search advertisers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ok">Live</SelectItem>
              <SelectItem value="danger">Failing</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="muted">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
              No advertisers found
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Advertiser</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-24 text-right">24h Sent</TableHead>
                      <TableHead className="w-20 text-right">Failed</TableHead>
                      <TableHead className="w-20 text-right">Hourly</TableHead>
                      <TableHead className="w-40">Daily Usage</TableHead>
                      <TableHead className="w-44">Working Hours</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((a) => {
                      const stats = throughput?.byAdv[a.id];
                      const setting = (settings || []).find((s) => s.advertiser_id === a.id);
                      const cap = setting?.default_daily_cap ?? null;
                      const sent24 = stats?.sent24 ?? todayCounts[a.id] ?? 0;
                      const failed24 = stats?.failed24 ?? 0;
                      const sentHour = stats?.sentHour ?? 0;
                      const pct = cap ? Math.min(100, (sent24 / cap) * 100) : 0;
                      const status = statusFor(a, stats);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full shrink-0", TONE_BAR[status.tone])} />
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              {a.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {status.tone === "danger" ? (
                              <button
                                type="button"
                                onClick={() => setIssuesAdvertiserId(a.id)}
                                title="Click to see recent failures"
                              >
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "gap-1 text-[10px] cursor-pointer ring-1 ring-red-500/40 hover:ring-red-500/70",
                                    TONE_BADGE[status.tone]
                                  )}
                                >
                                  <CircleDot className="h-2.5 w-2.5" />
                                  {status.label}
                                </Badge>
                              </button>
                            ) : (
                              <Badge variant="outline" className={cn("gap-1 text-[10px]", TONE_BADGE[status.tone])}>
                                <CircleDot className="h-2.5 w-2.5" />
                                {status.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{sent24}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", failed24 > 0 && "text-destructive")}>
                            {failed24}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{sentHour}</TableCell>
                          <TableCell>
                            <div className="flex items-baseline justify-between text-xs tabular-nums">
                              <span>{sent24}</span>
                              <span className="text-muted-foreground">{cap != null ? `/ ${cap}` : "/ ∞"}</span>
                            </div>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded transition-all",
                                  pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {summarizeWorkingHours(setting)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleCardClick(a.id)}>
                              Configure
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filtered.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                itemLabel="advertisers"
              />
            </CardFooter>
          </Card>
        )}
      </div>

      {/* Config dialog */}
      <Dialog
        open={!!selectedAdvertiser}
        onOpenChange={(o) => { if (!o) setSelectedAdvertiserId(null); }}
      >
        <DialogContent className="top-0 sm:top-1/2 left-0 sm:left-1/2 translate-x-0 sm:-translate-x-1/2 translate-y-0 sm:-translate-y-1/2 w-full sm:max-w-5xl h-screen sm:h-auto rounded-none sm:rounded-lg p-0 gap-0 overflow-hidden">
          {selectedAdvertiser && (
            <div className="flex flex-col h-screen sm:h-[88vh] overflow-hidden">
              <AdvertiserConfigPanel
                key={selectedAdvertiser.id}
                advertiser={{
                  ...selectedAdvertiser,
                  url: (selectedAdvertiser as any).url ?? null,
                  api_key: (selectedAdvertiser as any).api_key ?? null,
                  config: (selectedAdvertiser as any).config ?? null,
                }}
                setting={
                  selectedSetting
                    ? {
                        advertiser_id: selectedSetting.advertiser_id,
                        is_active: selectedSetting.is_active,
                        base_weight: selectedSetting.base_weight,
                        default_daily_cap: selectedSetting.default_daily_cap,
                        default_hourly_cap: selectedSetting.default_hourly_cap,
                        start_time: selectedSetting.start_time,
                        end_time: selectedSetting.end_time,
                        countries: selectedSetting.countries,
                        affiliates: selectedSetting.affiliates,
                        weekly_schedule: (selectedSetting as any).weekly_schedule,
                        overflow_option: (selectedSetting as any).overflow_option ?? "next_advertiser",
                        timezone: (selectedSetting as any).timezone ?? "UTC",
                      }
                    : null
                }
                affiliates={affiliates || []}
                allAdvertisers={advertisers || []}
                allSettings={(settings || []).map((s) => ({
                  advertiser_id: s.advertiser_id,
                  is_active: s.is_active,
                  base_weight: s.base_weight,
                  default_daily_cap: s.default_daily_cap,
                  default_hourly_cap: s.default_hourly_cap,
                  start_time: s.start_time,
                  end_time: s.end_time,
                  countries: s.countries,
                  affiliates: s.affiliates,
                  weekly_schedule: (s as any).weekly_schedule,
                }))}
                todayCount={todayCounts[selectedAdvertiserId!] ?? 0}
                onSave={handleSaveSetting}
                isSaving={upsertSetting.isPending}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent failures dialog */}
      <Dialog
        open={!!issuesAdvertiserId}
        onOpenChange={(o) => { if (!o) setIssuesAdvertiserId(null); }}
      >
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold">
              {issuesAdvertiser?.name} — {advertiserFailures?.length ?? 0} failure
              {advertiserFailures?.length === 1 ? "" : "s"} in the last 24h
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loadingFailures ? (
              <div className="space-y-2 py-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !advertiserFailures || advertiserFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No failures in the last 24h — this may have just rolled out of the window.
              </p>
            ) : (
              <div className="space-y-2 py-1">
                {advertiserFailures.map((f) => (
                  <div key={f.id} className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1">
                    <div className="text-muted-foreground">{new Date(f.created_at).toLocaleString()}</div>
                    {f.request_url && (
                      <div className="font-mono text-muted-foreground break-all">{f.request_url}</div>
                    )}
                    <div className="font-mono break-all whitespace-pre-wrap">
                      {f.response || "No response recorded"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Issues summary dialog */}
      <Dialog open={issuesSummaryOpen} onOpenChange={setIssuesSummaryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {issues.length} issue{issues.length === 1 ? "" : "s"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className="rounded-md border bg-amber-500/5 border-amber-500/20 px-3 py-2 text-sm">
                {issue}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
