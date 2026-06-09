import { useMemo } from "react";
import { Activity, TrendingUp, XCircle, Clock } from "lucide-react";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { cn } from "@/lib/utils";

interface Advertiser {
  id: string;
  name: string;
  is_active: boolean;
}

interface Setting {
  advertiser_id: string;
  is_active: boolean;
  default_daily_cap: number | null;
}

interface TelemetryStripProps {
  advertisers: Advertiser[];
  settings: Setting[];
  todayCounts: Record<string, number>;
}

export function TelemetryStrip({ advertisers, settings, todayCounts }: TelemetryStripProps) {
  const { data } = useLiveTelemetry();

  const advMap = useMemo(() => new Map(advertisers.map(a => [a.id, a])), [advertisers]);

  const top3 = useMemo(() => {
    if (!data?.lastHourCounts) return [];
    return Object.entries(data.lastHourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id, count]) => ({ name: advMap.get(id)?.name ?? id.slice(0, 8), count }));
  }, [data?.lastHourCounts, advMap]);

  const nextToCap = useMemo(() => {
    if (!data?.lastHourCounts) return null;
    let soonest: { name: string; hoursLeft: number } | null = null;

    for (const s of settings) {
      if (!s.is_active || s.default_daily_cap == null) continue;
      const today = todayCounts[s.advertiser_id] ?? 0;
      const remaining = s.default_daily_cap - today;
      if (remaining <= 0) continue;
      const hourlyRate = data.lastHourCounts[s.advertiser_id] ?? 0;
      if (hourlyRate <= 0) continue;
      const hoursLeft = remaining / hourlyRate;
      const adv = advMap.get(s.advertiser_id);
      if (adv?.is_active && (!soonest || hoursLeft < soonest.hoursLeft)) {
        soonest = { name: adv.name, hoursLeft };
      }
    }
    return soonest;
  }, [data, settings, todayCounts, advMap]);

  const isLive = (data?.leadsPerMin ?? 0) > 0;
  const rejPct = data ? Math.round(data.rejectionRate * 100) : null;

  return (
    <div className="flex items-center gap-5 px-6 py-2 border-b bg-muted/20 text-sm shrink-0 overflow-x-auto whitespace-nowrap">
      {/* Live pulse + leads/min */}
      <div className="flex items-center gap-2 shrink-0">
        <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            isLive ? "bg-green-500 animate-pulse" : "bg-gray-400"
          )}
        />
        <span className="font-medium tabular-nums">{data?.leadsPerMin ?? 0}</span>
        <span className="text-muted-foreground">leads/min</span>
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Top 3 advertisers last hour */}
      <div className="flex items-center gap-2 shrink-0">
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {top3.length > 0 ? (
          <span className="flex items-center gap-2">
            {top3.map((a, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-border">·</span>}
                <span className="font-medium max-w-[100px] truncate">{a.name}</span>
                <span className="text-muted-foreground text-xs">({a.count}/hr)</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">No traffic in last hour</span>
        )}
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Rejection rate */}
      <div className="flex items-center gap-2 shrink-0">
        <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span
          className={cn(
            "font-medium tabular-nums",
            rejPct != null && rejPct > 10 ? "text-destructive" : ""
          )}
        >
          {rejPct != null ? `${rejPct}%` : "—"}
        </span>
        <span className="text-muted-foreground">rejected</span>
      </div>

      {/* Next to cap */}
      {nextToCap && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{nextToCap.name}</span>
              {" caps in "}
              <span className="font-medium text-foreground">
                {nextToCap.hoursLeft < 1
                  ? `${Math.round(nextToCap.hoursLeft * 60)}m`
                  : `${nextToCap.hoursLeft.toFixed(1)}h`}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
