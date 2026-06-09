import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, Trophy, CheckCircle2, XCircle, Clock, Shield } from "lucide-react";
import { useDistributionSettings } from "@/hooks/useDistributionSettings";
import { useAllDistributionRules } from "@/hooks/useAffiliateDistributionRules";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useTodayDistributionCounts } from "@/hooks/useTodayDistributionCounts";
import { countryData } from "@/components/advertisers/countryData";
import { runRouting, type FilterReason } from "@/lib/routingEngine";
import { cn } from "@/lib/utils";

const REASON_LABELS: Record<FilterReason, { label: string; icon: React.ReactNode }> = {
  advertiser_inactive: { label: "Advertiser disabled", icon: <XCircle className="h-3 w-3 text-destructive" /> },
  setting_inactive: { label: "Distribution paused", icon: <XCircle className="h-3 w-3 text-destructive" /> },
  country_not_allowed: { label: "Country not allowed", icon: <Shield className="h-3 w-3 text-orange-500" /> },
  affiliate_not_allowed: { label: "Affiliate not allowed", icon: <Shield className="h-3 w-3 text-orange-500" /> },
  outside_schedule: { label: "Outside schedule", icon: <Clock className="h-3 w-3 text-yellow-500" /> },
  daily_cap_hit: { label: "Daily cap reached", icon: <XCircle className="h-3 w-3 text-red-500" /> },
  affiliate_rule_inactive: { label: "Rule inactive", icon: <XCircle className="h-3 w-3 text-destructive" /> },
};

export function SimulationPanel() {
  const { data: advertisers = [] } = useAdvertisers();
  const { data: settings = [] } = useDistributionSettings();
  const { data: allRules = [] } = useAllDistributionRules();
  const { data: affiliates = [] } = useAffiliates();
  const { data: todayCounts = {} } = useTodayDistributionCounts();

  const [country, setCountry] = useState("");
  const [affiliateId, setAffiliateId] = useState("__all__");
  const [simulatedDate, setSimulatedDate] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [hasSimulated, setHasSimulated] = useState(false);

  const results = useMemo(() => {
    if (!hasSimulated || !country) return [];
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
    return runRouting(
      country,
      affiliateId === "__all__" ? "" : affiliateId,
      new Date(simulatedDate),
      advertisers,
      settingsMapped,
      allRules as any[],
      todayCounts
    );
  }, [hasSimulated, country, affiliateId, simulatedDate, advertisers, settings, allRules, todayCounts]);

  const winner = results.find(r => r.rank === 1);
  const countries = useMemo(
    () => Object.entries(countryData).sort((a, b) => a[1].name.localeCompare(b[1].name)),
    []
  );

  return (
    <div className="flex flex-col h-full border-l bg-muted/10">
      <div className="px-4 py-3 border-b shrink-0">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Live Simulation
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Replay a lead to see which advertiser wins</p>
      </div>

      <div className="px-4 py-3 border-b shrink-0 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <Select value={country} onValueChange={v => { setCountry(v); setHasSimulated(false); }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select country..." />
            </SelectTrigger>
            <SelectContent>
              {countries.map(([code, c]) => (
                <SelectItem key={code} value={code} className="text-xs">{code} — {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Affiliate</Label>
          <Select value={affiliateId} onValueChange={v => { setAffiliateId(v); setHasSimulated(false); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All affiliates (global rules)</SelectItem>
              {affiliates.map(a => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name}{!a.is_active && " (inactive)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Simulated time</Label>
          <Input
            type="datetime-local"
            value={simulatedDate}
            onChange={e => { setSimulatedDate(e.target.value); setHasSimulated(false); }}
            className="h-8 text-xs"
          />
        </div>

        <Button size="sm" className="w-full" onClick={() => setHasSimulated(true)} disabled={!country}>
          <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
          Simulate
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {!hasSimulated && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
            <FlaskConical className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-xs">Select a country and click Simulate.</p>
          </div>
        )}

        {hasSimulated && results.length > 0 && (
          <div className="p-3 space-y-3">
            {winner ? (
              <div className="rounded-lg border-2 border-green-500 bg-green-500/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Winner</span>
                </div>
                <p className="font-semibold text-sm">{winner.name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="outline" className="text-xs">priority {winner.priority}</Badge>
                  <Badge variant="outline" className="text-xs">weight {winner.weight}</Badge>
                  {winner.source === "affiliate_rule" && (
                    <Badge variant="secondary" className="text-xs">affiliate rule</Badge>
                  )}
                </div>
                {winner.pct < 100 && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Gets {winner.pct}% of leads in this priority tier
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-destructive bg-destructive/5 p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-semibold text-destructive">No winner — lead rejected</span>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full ranking</p>
              {results.map(r => (
                <div
                  key={r.advertiserId}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs",
                    r.filterReason ? "bg-muted/50 text-muted-foreground"
                      : r.rank === 1 ? "bg-green-500/10 text-foreground"
                        : "bg-background border"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {r.filterReason
                      ? <span className="shrink-0">{REASON_LABELS[r.filterReason].icon}</span>
                      : r.rank === 1
                        ? <Trophy className="h-3 w-3 text-green-600 shrink-0" />
                        : <CheckCircle2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    }
                    <span className={cn("font-medium truncate flex-1", r.rank === 1 && "text-green-700")}>
                      {r.rank && <span className="mr-1 text-muted-foreground">#{r.rank}</span>}
                      {r.name}
                    </span>
                    {!r.filterReason && r.pct > 0 && r.pct < 100 && (
                      <span className="text-muted-foreground shrink-0">{r.pct}%</span>
                    )}
                  </div>
                  {r.filterReason && (
                    <p className="mt-0.5 pl-5 text-xs text-muted-foreground">
                      {REASON_LABELS[r.filterReason].label}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Separator />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>{results.filter(r => !r.filterReason).length} eligible, {results.filter(r => r.filterReason).length} filtered</p>
              <p>Source: {results[0]?.source === "affiliate_rule" ? "affiliate-specific rules" : "global settings"}</p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
