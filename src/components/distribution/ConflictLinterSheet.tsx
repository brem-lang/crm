import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle, Info, CheckCircle2 } from "lucide-react";
import { isHeatmapSchedule } from "@/lib/scheduleUtils";
import { useDistributionSettings } from "@/hooks/useDistributionSettings";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useRecentDistributionStats } from "@/hooks/useRecentDistributionStats";

export type LinterSeverity = "error" | "warning" | "info";

export interface LinterWarning {
  id: string;
  severity: LinterSeverity;
  title: string;
  description: string;
}

const SEVERITY_ICON: Record<LinterSeverity, React.ReactNode> = {
  error: <XCircle className="h-4 w-4 text-destructive shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
  info: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
};

const SEVERITY_BADGE: Record<LinterSeverity, "destructive" | "outline" | "secondary"> = {
  error: "destructive",
  warning: "outline",
  info: "secondary",
};

export function computeWarnings(
  advertisers: { id: string; name: string; is_active: boolean }[],
  settings: {
    advertiser_id: string;
    is_active: boolean;
    priority: number;
    default_daily_cap: number | null;
    weekly_schedule?: unknown;
  }[],
  avgStats: Record<string, number>
): LinterWarning[] {
  const warnings: LinterWarning[] = [];
  const advMap = new Map(advertisers.map(a => [a.id, a]));

  // 1. Advertiser disabled but distribution active
  for (const s of settings) {
    if (!s.is_active) continue;
    const adv = advMap.get(s.advertiser_id);
    if (!adv?.is_active) {
      warnings.push({
        id: `inactive-adv-${s.advertiser_id}`,
        severity: "error",
        title: `"${adv?.name ?? "Unknown"}" is disabled but distribution is active`,
        description: "The advertiser integration is turned off. Leads will not be sent here despite the active distribution setting.",
      });
    }
  }

  // 2. Active advertiser with empty schedule heatmap
  for (const s of settings) {
    if (!s.is_active) continue;
    const adv = advMap.get(s.advertiser_id);
    if (!adv?.is_active) continue;
    const ws = s.weekly_schedule;
    if (isHeatmapSchedule(ws)) {
      const activeHours = ws.matrix.flat().filter(Boolean).length;
      if (activeHours === 0) {
        warnings.push({
          id: `empty-schedule-${s.advertiser_id}`,
          severity: "warning",
          title: `"${adv.name}" has no active hours in schedule`,
          description: "The heatmap schedule has zero active cells. No leads will be routed here based on the schedule.",
        });
      }
    }
  }

  // 3. No active advertisers at all
  const activeSettings = settings.filter(s => {
    const adv = advMap.get(s.advertiser_id);
    return s.is_active && adv?.is_active;
  });
  if (settings.length > 0 && activeSettings.length === 0) {
    warnings.push({
      id: "no-active-advertisers",
      severity: "error",
      title: "No active advertisers configured",
      description: "All advertisers are paused or inactive. All incoming leads will be rejected.",
    });
  }

  // 4. All active advertisers at same priority (no fallback chain)
  if (activeSettings.length > 1) {
    const priorities = [...new Set(activeSettings.map(s => s.priority))];
    if (priorities.length === 1) {
      warnings.push({
        id: "no-fallback-chain",
        severity: "info",
        title: "No fallback priority chain",
        description: `All ${activeSettings.length} active advertisers share priority ${priorities[0]}. If the top tier is fully capped or offline, there's no fallback tier to absorb leads.`,
      });
    }
  }

  // 5. Cap underflow: combined top-priority cap < 7-day average volume
  if (activeSettings.length > 0) {
    const topPriority = Math.min(...activeSettings.map(s => s.priority));
    const topTier = activeSettings.filter(s => s.priority === topPriority);
    const totalDailyVolume = Object.values(avgStats).reduce((s, v) => s + v, 0);

    if (totalDailyVolume > 0) {
      const finiteCapTotal = topTier.reduce((sum, s) => {
        return s.default_daily_cap != null ? sum + s.default_daily_cap : sum;
      }, 0);
      const allUncapped = topTier.every(s => s.default_daily_cap == null);
      if (!allUncapped && finiteCapTotal < totalDailyVolume * 0.8) {
        const shortfall = Math.round(totalDailyVolume - finiteCapTotal);
        warnings.push({
          id: "cap-underflow",
          severity: "warning",
          title: `Combined cap may be too low (${shortfall} leads/day uncovered)`,
          description: `Top-priority tier combined cap: ${finiteCapTotal}/day. Recent 7-day average volume: ~${Math.round(totalDailyVolume)}/day. Up to ${shortfall} leads may be unrouted daily.`,
        });
      }
    }
  }

  return warnings;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ConflictLinterSheet({ open, onOpenChange }: Props) {
  const { data: advertisers = [] } = useAdvertisers();
  const { data: settings = [] } = useDistributionSettings();
  const { data: avgStats = {} } = useRecentDistributionStats(7);

  const warnings = useMemo(
    () => computeWarnings(advertisers, settings as any[], avgStats),
    [advertisers, settings, avgStats]
  );

  const errors = warnings.filter(w => w.severity === "error");
  const cautions = warnings.filter(w => w.severity === "warning");
  const infos = warnings.filter(w => w.severity === "info");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Conflict Linter
            {warnings.length > 0 && (
              <Badge variant={errors.length > 0 ? "destructive" : "outline"} className="ml-1">
                {warnings.length}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {warnings.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-3 text-green-500 opacity-60" />
              <p className="font-medium">No conflicts detected</p>
              <p className="text-sm mt-1">Your distribution configuration looks clean.</p>
            </div>
          )}

          {[...errors, ...cautions, ...infos].map(w => (
            <div key={w.id} className="flex gap-3 rounded-lg border p-3">
              {SEVERITY_ICON[w.severity]}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{w.title}</p>
                  <Badge variant={SEVERITY_BADGE[w.severity]} className="text-xs shrink-0">
                    {w.severity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{w.description}</p>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Small badge for the toolbar — computes warnings inline. */
export function ConflictLinterBadge({
  advertisers,
  settings,
  avgStats,
  onClick,
}: {
  advertisers: { id: string; name: string; is_active: boolean }[];
  settings: any[];
  avgStats: Record<string, number>;
  onClick: () => void;
}) {
  const warnings = useMemo(
    () => computeWarnings(advertisers, settings, avgStats),
    [advertisers, settings, avgStats]
  );
  const errors = warnings.filter(w => w.severity === "error").length;
  const total = warnings.length;

  if (total === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors hover:bg-muted"
    >
      {errors > 0 ? (
        <XCircle className="h-3.5 w-3.5 text-destructive" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
      )}
      <span className={errors > 0 ? "text-destructive" : "text-yellow-600"}>
        {total} {total === 1 ? "issue" : "issues"}
      </span>
    </button>
  );
}
