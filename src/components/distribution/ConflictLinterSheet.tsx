import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle, Info, CheckCircle2, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
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
  advertiser_id?: string;
  details?: { label: string; value: string }[];
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
        advertiser_id: s.advertiser_id,
        details: [
          { label: "Advertiser status", value: "Inactive" },
          { label: "Distribution status", value: "Active" },
          { label: "Impact", value: "All leads routed to this advertiser will be silently dropped." },
          { label: "Fix", value: "Re-enable the advertiser, or pause the distribution setting for this advertiser." },
        ],
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
          advertiser_id: s.advertiser_id,
          details: [
            { label: "Active hours", value: "0 / 168" },
            { label: "Schedule type", value: "Heatmap" },
            { label: "Impact", value: "No leads will be sent regardless of volume or priority." },
            { label: "Fix", value: "Open the schedule heatmap and enable at least one time slot." },
          ],
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
    const pausedNames = settings
      .map(s => advMap.get(s.advertiser_id)?.name)
      .filter(Boolean)
      .join(", ");
    warnings.push({
      id: "no-active-advertisers",
      severity: "error",
      title: "No active advertisers configured",
      description: "All advertisers are paused or inactive. All incoming leads will be rejected.",
      details: [
        { label: "Active advertisers", value: "0" },
        { label: "Total configured", value: String(settings.length) },
        { label: "Paused advertisers", value: pausedNames || "—" },
        { label: "Impact", value: "100% of incoming leads will be rejected until at least one advertiser is active." },
        { label: "Fix", value: "Activate at least one advertiser and enable its distribution setting." },
      ],
    });
  }

  // 4. All active advertisers at same priority (no fallback chain)
  if (activeSettings.length > 1) {
    const priorities = [...new Set(activeSettings.map(s => s.priority))];
    if (priorities.length === 1) {
      const names = activeSettings
        .map(s => advMap.get(s.advertiser_id)?.name)
        .filter(Boolean)
        .join(", ");
      warnings.push({
        id: "no-fallback-chain",
        severity: "info",
        title: "No fallback priority chain",
        description: `All ${activeSettings.length} active advertisers share priority ${priorities[0]}. If the top tier is fully capped or offline, there's no fallback tier to absorb leads.`,
        details: [
          { label: "Shared priority", value: String(priorities[0]) },
          { label: "Affected advertisers", value: names || "—" },
          { label: "Impact", value: "If all advertisers in this tier are capped simultaneously, leads will be rejected instead of falling through to a backup tier." },
          { label: "Fix", value: "Assign different priority levels (e.g. primary = 1, fallback = 2) so leads cascade down when the top tier is unavailable." },
        ],
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
        const coveragePct = Math.round((finiteCapTotal / totalDailyVolume) * 100);
        warnings.push({
          id: "cap-underflow",
          severity: "warning",
          title: `Combined cap may be too low (${shortfall} leads/day uncovered)`,
          description: `Top-priority tier combined cap: ${finiteCapTotal}/day. Recent 7-day average volume: ~${Math.round(totalDailyVolume)}/day. Up to ${shortfall} leads may be unrouted daily.`,
          details: [
            { label: "Combined daily cap", value: `${finiteCapTotal} leads/day` },
            { label: "7-day avg volume", value: `~${Math.round(totalDailyVolume)} leads/day` },
            { label: "Coverage", value: `${coveragePct}% of average volume` },
            { label: "Uncovered leads", value: `~${shortfall} leads/day` },
            { label: "Fix", value: "Raise the daily cap on top-priority advertisers, or add a lower-priority fallback advertiser to catch overflow." },
          ],
        });
      }
    }
  }

  return warnings;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectAdvertiser?: (advertiserId: string) => void;
}

export function ConflictLinterSheet({ open, onOpenChange, onSelectAdvertiser }: Props) {
  const { data: advertisers = [] } = useAdvertisers();
  const { data: settings = [] } = useDistributionSettings();
  const { data: avgStats = {} } = useRecentDistributionStats(7);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const warnings = useMemo(
    () => computeWarnings(advertisers, settings as any[], avgStats),
    [advertisers, settings, avgStats]
  );

  const errors = warnings.filter(w => w.severity === "error");
  const cautions = warnings.filter(w => w.severity === "warning");
  const infos = warnings.filter(w => w.severity === "info");

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGoToAdvertiser = (advertiserId: string) => {
    onOpenChange(false);
    onSelectAdvertiser?.(advertiserId);
  };

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

        <div className="mt-6 space-y-2">
          {warnings.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-3 text-green-500 opacity-60" />
              <p className="font-medium">No conflicts detected</p>
              <p className="text-sm mt-1">Your distribution configuration looks clean.</p>
            </div>
          )}

          {[...errors, ...cautions, ...infos].map(w => {
            const isExpanded = expandedIds.has(w.id);
            return (
              <div key={w.id} className="rounded-lg border overflow-hidden">
                {/* Header row — clickable to expand */}
                <button
                  className="w-full flex gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpand(w.id)}
                >
                  <span className="mt-0.5">{SEVERITY_ICON[w.severity]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{w.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={SEVERITY_BADGE[w.severity]} className="text-xs">
                          {w.severity}
                        </Badge>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{w.description}</p>
                  </div>
                </button>

                {/* Expanded detail panel */}
                {isExpanded && w.details && (
                  <div className="border-t bg-muted/20 px-3 py-3 space-y-3">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                      {w.details.map(d => (
                        <div key={d.label} className="contents">
                          <dt className="text-xs font-medium text-muted-foreground whitespace-nowrap">{d.label}</dt>
                          <dd className="text-xs text-foreground">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {w.advertiser_id && onSelectAdvertiser && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleGoToAdvertiser(w.advertiser_id!)}
                      >
                        Go to Advertiser
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
