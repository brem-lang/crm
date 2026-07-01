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
import { ConflictLinterBadge, ConflictLinterSheet } from "@/components/distribution/ConflictLinterSheet";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Search,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Zap,
} from "lucide-react";

const PAGE_SIZE = 12;

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
  const [linterOpen, setLinterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: advertisers, isLoading: loadingAdvertisers } = useAdvertisers();
  const { data: affiliates, isLoading: loadingAffiliates } = useAffiliates();
  const { data: settings, isLoading: loadingSettings } = useDistributionSettings();
  const { data: todayCounts = {} } = useTodayDistributionCounts();
  const { data: avgStats = {} } = useRecentDistributionStats(7);
  const { data: throughput, isLoading: loadingThroughput } = useThroughput();

  const upsertSetting = useUpsertDistributionSetting();

  // ── derived ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const list = advertisers || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [advertisers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

  const selectedAdvertiser = (advertisers || []).find((a) => a.id === selectedAdvertiserId) ?? null;
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-40" />)}
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
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 px-2.5 py-1 font-medium",
                issues.length === 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {issues.length === 0 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {issues.length === 0 ? "All systems normal" : `${issues.length} issues`}
            </Badge>

            {/* Conflict linter badge (detailed) */}
            <ConflictLinterBadge
              advertisers={advertisers || []}
              settings={settings as any[] || []}
              avgStats={avgStats}
            />

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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search advertisers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        {/* Card grid */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
              No advertisers found
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginated.map((a) => {
              const stats = throughput?.byAdv[a.id];
              const setting = (settings || []).find((s) => s.advertiser_id === a.id);
              const cap = setting?.default_daily_cap ?? null;
              const sent24 = stats?.sent24 ?? todayCounts[a.id] ?? 0;
              const pct = cap ? Math.min(100, (sent24 / cap) * 100) : 0;
              const status = statusFor(a, stats);
              return (
                <button
                  key={a.id}
                  onClick={() => handleCardClick(a.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border bg-card p-4 text-left shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                    "focus:outline-none focus:ring-2 focus:ring-primary/40"
                  )}
                >
                  {/* Status color bar */}
                  <span className={cn("absolute inset-x-0 top-0 h-1", TONE_BAR[status.tone])} />

                  <div className="flex items-start justify-between gap-2 mt-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted/40 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className={cn("gap-1 text-[10px] shrink-0", TONE_BADGE[status.tone])}>
                      <CircleDot className="h-2.5 w-2.5" />
                      {status.label}
                    </Badge>
                  </div>

                  <h3 className="mt-3 truncate text-sm font-semibold">{a.name}</h3>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">24h sent</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {sent24}
                      {cap != null ? (
                        <span className="text-muted-foreground"> / {cap}</span>
                      ) : (
                        <span className="text-muted-foreground"> / ∞</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-muted">
                    <div
                      className={cn(
                        "h-full rounded transition-all",
                        pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} advertisers
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  className="w-8"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
    </DashboardLayout>
  );
}
