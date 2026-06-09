import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FlaskConical, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useDistributionSettings } from "@/hooks/useDistributionSettings";
import { useAllDistributionRules } from "@/hooks/useAffiliateDistributionRules";
import { useTodayDistributionCounts } from "@/hooks/useTodayDistributionCounts";
import { useDryRunLeads } from "@/hooks/useDryRunLeads";
import { runRouting, getWinner } from "@/lib/routingEngine";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DryRunSheet({ open, onOpenChange }: Props) {
  const { data: advertisers = [] } = useAdvertisers();
  const { data: settings = [] } = useDistributionSettings();
  const { data: allRules = [] } = useAllDistributionRules();
  const { data: todayCounts = {} } = useTodayDistributionCounts();
  const { data: leads = [], isFetching, refetch, isFetched } = useDryRunLeads(1000);

  // Actual distribution from historical data
  const actualCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      counts[lead.actual_advertiser_id] = (counts[lead.actual_advertiser_id] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  // Simulated distribution: replay each lead through current routing logic
  const simulatedCounts = useMemo(() => {
    if (!isFetched || !leads.length) return {};
    const counts: Record<string, number> = {};
    const now = new Date();

    const settingsMapped = (settings as any[]).map(s => ({
      advertiser_id: s.advertiser_id,
      is_active: s.is_active,
      priority: s.priority,
      base_weight: s.base_weight,
      default_daily_cap: s.default_daily_cap,
      countries: s.countries,
      affiliates: s.affiliates,
      start_time: s.start_time,
      end_time: s.end_time,
      weekly_schedule: s.weekly_schedule,
    }));

    // Use a zeroed-out cap counter so schedule/cap doesn't skew the replay
    const zeroedCounts: Record<string, number> = {};

    for (const lead of leads) {
      const results = runRouting(
        lead.country_code,
        lead.affiliate_id,
        now,
        advertisers,
        settingsMapped,
        allRules as any[],
        zeroedCounts
      );
      const winner = getWinner(results);
      if (winner) {
        counts[winner] = (counts[winner] ?? 0) + 1;
      }
    }
    return counts;
  }, [leads, isFetched, advertisers, settings, allRules]);

  // Merge into rows per advertiser
  const rows = useMemo(() => {
    const advMap = new Map(advertisers.map(a => [a.id, a]));
    const allIds = new Set([...Object.keys(actualCounts), ...Object.keys(simulatedCounts)]);
    return [...allIds]
      .map(id => {
        const actual = actualCounts[id] ?? 0;
        const simulated = simulatedCounts[id] ?? 0;
        return {
          id,
          name: advMap.get(id)?.name ?? id.slice(0, 8),
          actual,
          simulated,
          delta: simulated - actual,
        };
      })
      .sort((a, b) => b.actual - a.actual);
  }, [actualCounts, simulatedCounts, advertisers]);

  const totalLeads = leads.length;
  const totalSimulated = Object.values(simulatedCounts).reduce((s, v) => s + v, 0);
  const unrouted = totalLeads - totalSimulated;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[580px] sm:max-w-[580px] flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Dry Run
          </SheetTitle>
          <SheetDescription>
            Replays the last 1 000 sent leads through the current routing config. Compare what
            actually happened vs. what the current rules would do now.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isFetched ? `${totalLeads} leads loaded` : "Press run to load leads"}
          </div>
          <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", isFetching && "animate-spin")} />
            {isFetched ? "Refresh" : "Run"}
          </Button>
        </div>

        {/* Stats bar */}
        {isFetched && totalLeads > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Leads analyzed</p>
              <p className="text-xl font-bold">{totalLeads}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Would route</p>
              <p className="text-xl font-bold text-green-600">{totalSimulated}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Would drop</p>
              <p className={cn("text-xl font-bold", unrouted > 0 ? "text-destructive" : "")}>
                {unrouted}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto mt-4">
          {isFetching && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!isFetching && !isFetched && (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <FlaskConical className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Click "Run" to load the last 1 000 leads and compare routing.</p>
            </div>
          )}

          {isFetched && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advertiser</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Simulated</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.actual}</TableCell>
                    <TableCell className="text-right">{row.simulated}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "flex items-center justify-end gap-1 font-medium",
                        row.delta > 0 ? "text-green-600" : row.delta < 0 ? "text-red-600" : "text-muted-foreground"
                      )}>
                        {row.delta > 0 && <TrendingUp className="h-3 w-3" />}
                        {row.delta < 0 && <TrendingDown className="h-3 w-3" />}
                        {row.delta === 0 && <Minus className="h-3 w-3" />}
                        {row.delta > 0 ? "+" : ""}{row.delta}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {unrouted > 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground italic">Unrouted / rejected</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-destructive font-medium">{unrouted}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive" className="text-xs">no winner</Badge>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {isFetched && rows.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No distribution data found in the selected period.
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-3 border-t mt-2">
          Note: simulation uses current config with today's caps zeroed to avoid skewing replay.
          Schedule checks use the current time.
        </p>
      </SheetContent>
    </Sheet>
  );
}
