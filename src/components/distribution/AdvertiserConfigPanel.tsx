import { useState, useMemo } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Clock, Globe, Sliders, Zap, Bell, Copy, Trash2, Plus, Check, ClipboardCheck, X } from "lucide-react";
import { ScheduleHeatmap, type HeatmapConfig } from "./ScheduleHeatmap";
import { countryData } from "@/components/advertisers/countryData";
import { useRestrictedCountries } from "@/hooks/useRestrictedCountries";
import {
  isHeatmapSchedule,
  legacyScheduleToMatrix,
  emptyMatrix,
} from "@/lib/scheduleUtils";
import type { WeeklySchedule } from "./WeeklyScheduleSelector";
import { useAdvertiserHourlyStats } from "@/hooks/useAdvertiserHourlyStats";
import { useUpdateAdvertiser } from "@/hooks/useAdvertisers";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "caps", label: "Caps & Pacing", icon: Zap },
  { id: "geo", label: "Geo and Affiliate", icon: Globe },
  { id: "schedule", label: "Working Hours", icon: Clock },
  { id: "overrides", label: "Overrides", icon: Sliders },
  { id: "review", label: "Review", icon: ClipboardCheck },
] as const;

interface Advertiser {
  id: string;
  name: string;
  is_active: boolean;
  advertiser_type: string;
  url: string | null;
  api_key: string | null;
  config: Record<string, string> | null;
}

interface DistSetting {
  advertiser_id: string;
  is_active: boolean;
  base_weight: number | null;
  default_daily_cap: number | null;
  default_hourly_cap: number | null;
  start_time: string | null;
  end_time: string | null;
  countries: string[] | null;
  affiliates: string[] | null;
  weekly_schedule?: unknown;
}

interface Affiliate {
  id: string;
  name: string;
  is_active: boolean;
}

interface AdvertiserConfigPanelProps {
  advertiser: Advertiser;
  setting: DistSetting | null;
  affiliates: Affiliate[];
  allAdvertisers: Advertiser[];
  allSettings: DistSetting[];
  todayCount: number;
  onSave: (updates: Partial<DistSetting> & { advertiser_id: string }) => void;
  isSaving: boolean;
}

function initHeatmapConfig(ws: unknown): HeatmapConfig {
  if (isHeatmapSchedule(ws)) {
    return {
      matrix: ws.matrix,
      timezone: ws.timezone ?? "UTC",
      smart_pacing: ws.smart_pacing ?? false,
      soft_cap_pct: ws.soft_cap_pct ?? null,
      custom_days: ws.custom_days,
      from_hour: ws.from_hour,
      to_hour: ws.to_hour,
    };
  }
  // Migrate legacy WeeklySchedule → heatmap matrix
  if (ws && typeof ws === "object" && !Array.isArray(ws) && !(ws as any).format) {
    return {
      matrix: legacyScheduleToMatrix(ws as WeeklySchedule),
      timezone: "UTC",
      smart_pacing: false,
      soft_cap_pct: null,
    };
  }
  return { matrix: emptyMatrix(), timezone: "UTC", smart_pacing: false, soft_cap_pct: null };
}

export function AdvertiserConfigPanel({
  advertiser,
  setting,
  affiliates,
  allAdvertisers,
  allSettings,
  todayCount,
  onSave,
  isSaving,
}: AdvertiserConfigPanelProps) {
  const defaultSetting: DistSetting = {
    advertiser_id: advertiser.id,
    is_active: false,
    base_weight: 100,
    default_daily_cap: 100,
    default_hourly_cap: null,
    start_time: "00:00",
    end_time: "23:59",
    countries: null,
    affiliates: null,
    weekly_schedule: null,
  };

  const current = setting ?? defaultSetting;
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<DistSetting>({ ...current });
  const [heatmap, setHeatmap] = useState<HeatmapConfig>(() =>
    initHeatmapConfig(current.weekly_schedule)
  );
  const [countryCaps, setCountryCaps] = useState<Record<string, number>>(
    () => (isHeatmapSchedule(current.weekly_schedule) ? (current.weekly_schedule as any).country_caps ?? {} : {})
  );

  const origCountryCaps = isHeatmapSchedule(current.weekly_schedule)
    ? (current.weekly_schedule as any).country_caps ?? {}
    : {};

  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(current) ||
    JSON.stringify(heatmap) !== JSON.stringify(initHeatmapConfig(current.weekly_schedule)) ||
    JSON.stringify(countryCaps) !== JSON.stringify(origCountryCaps);

  const update = (fields: Partial<DistSetting>) =>
    setDraft(prev => ({ ...prev, ...fields }));

  // Required-field validity per step. "Overrides" and "Review" have no requirements.
  const stepValidity: Record<string, boolean> = {
    caps: draft.default_daily_cap != null && draft.default_hourly_cap != null && !!draft.base_weight,
    geo: (draft.countries?.length ?? 0) > 0 && (draft.affiliates?.length ?? 0) > 0,
    schedule: heatmap.matrix.some(row => row.some(Boolean)),
    overrides: true,
    review: true,
  };

  // Can't reach a step past the first one whose required fields aren't filled in yet.
  const maxReachableIndex = (() => {
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (!stepValidity[STEPS[i].id]) return i;
    }
    return STEPS.length - 1;
  })();

  const updateAdvertiser = useUpdateAdvertiser();

  const handleActiveToggle = (value: boolean) => {
    updateAdvertiser.mutate({ id: advertiser.id, is_active: value, silent: true });
    update({ is_active: value });
  };

  const handleSave = () => {
    const heatmapSchedule = {
      format: "heatmap" as const,
      ...heatmap,
      ...(Object.keys(countryCaps).length > 0 ? { country_caps: countryCaps } : {}),
    };
    onSave({ ...draft, advertiser_id: advertiser.id, weekly_schedule: heatmapSchedule });
  };

  const { data: volumeData } = useAdvertiserHourlyStats(advertiser.id, heatmap.timezone);

  const cap = draft.default_daily_cap;
  const softPct = heatmap.soft_cap_pct;
  const capPct = cap ? Math.min(100, Math.round((todayCount / cap) * 100)) : null;
  const capVariant =
    capPct == null
      ? "secondary"
      : capPct >= 100
        ? "destructive"
        : softPct && capPct >= softPct
          ? "outline"
          : "secondary";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Panel header — pr-10 sm:pr-14 keeps content clear of the Dialog's absolute X button */}
      <div className="pl-4 sm:pl-6 pr-10 sm:pr-14 py-3 sm:py-4 border-b flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">{advertiser.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="adv-active" className="text-sm">Active</Label>
          <Switch
            id="adv-active"
            checked={advertiser.is_active}
            onCheckedChange={handleActiveToggle}
            disabled={updateAdvertiser.isPending}
          />
        </div>
      </div>

      <Tabs value={STEPS[stepIndex].id} className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Step indicator in a scrollable row so all 5 steps fit on narrow screens */}
        <div className="px-3 sm:px-6 mt-3 sm:mt-4 overflow-x-auto shrink-0">
          <div className="flex items-center w-max">
            {STEPS.map((step, idx) => {
              const reachable = idx <= maxReachableIndex;
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => reachable && setStepIndex(idx)}
                    disabled={!reachable}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                      !reachable
                        ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                        : idx === stepIndex
                          ? "bg-primary text-primary-foreground"
                          : idx < stepIndex
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border text-[10px] sm:text-xs shrink-0">
                      {idx < stepIndex ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {idx < STEPS.length - 1 && <div className="w-3 sm:w-6 h-px bg-border shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Caps & Pacing tab */}
          <TabsContent value="caps" className="m-3 sm:m-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily & Hourly Caps</CardTitle>
                <CardDescription>Maximum leads accepted per time period. All fields on this step are required.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Daily cap */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="space-y-1 flex-1 max-w-xs">
                    <Label>Daily cap <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Required"
                      value={draft.default_daily_cap ?? ""}
                      onChange={e =>
                        update({ default_daily_cap: e.target.value ? parseInt(e.target.value) : null })
                      }
                    />
                  </div>
                  {cap != null && (
                    <div className="sm:pt-6">
                      <Badge variant={capVariant}>
                        {todayCount} / {cap} today ({capPct}%)
                        {softPct && capPct != null && capPct >= softPct && capPct < 100 && (
                          <Bell className="h-3 w-3 ml-1 inline" />
                        )}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Hourly cap */}
                <div className="space-y-1 max-w-xs">
                  <Label>Hourly cap <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Required"
                    value={draft.default_hourly_cap ?? ""}
                    onChange={e =>
                      update({ default_hourly_cap: e.target.value ? parseInt(e.target.value) : null })
                    }
                  />
                </div>

                {/* Base weight */}
                <div className="space-y-1 max-w-xs">
                  <Label>Base weight <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={draft.base_weight ?? 100}
                    onChange={e => update({ base_weight: parseInt(e.target.value) || 100 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher weight = larger share within the same priority tier.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Smart pacing summary card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Smart Pacing
                  <Badge variant={heatmap.smart_pacing ? "default" : "secondary"} className="text-xs ml-auto">
                    {heatmap.smart_pacing ? "On" : "Off"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Spread the daily cap evenly across active schedule hours.
                  Configure in the Working Hours step.
                </CardDescription>
              </CardHeader>
              {heatmap.smart_pacing && cap != null && (
                <CardContent>
                  <SmartPacingInfo cap={cap} heatmap={heatmap} todayCount={todayCount} />
                </CardContent>
              )}
            </Card>

            {/* Soft-cap summary card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Soft-Cap Warning
                  <Badge
                    variant={heatmap.soft_cap_pct != null ? "default" : "secondary"}
                    className="text-xs ml-auto"
                  >
                    {heatmap.soft_cap_pct != null ? `${heatmap.soft_cap_pct}%` : "Off"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Alert when this advertiser reaches the threshold. Configure in the Working Hours step.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          {/* Schedule tab — 7×24 heatmap */}
          <TabsContent value="schedule" className="m-2 sm:m-6">
            <Card className="overflow-hidden">
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <CardTitle>Working Hours <span className="text-destructive">*</span></CardTitle>
                <CardDescription>
                  Click or drag cells to toggle active hours. Blue overlay shows actual received
                  volume (last 30 days). Smart pacing and soft-cap are saved with the schedule.
                  At least one active hour is required.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0 overflow-hidden">
                <ScheduleHeatmap
                  config={heatmap}
                  volumeData={volumeData}
                  onChange={setHeatmap}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Countries & Affiliates tab */}
          <TabsContent value="geo" className="m-3 sm:m-6 space-y-4">
            <CountriesCard
              selected={draft.countries ?? []}
              onChange={countries => update({ countries: countries.length ? countries : null })}
            />
            <AffiliatesCard
              affiliates={affiliates}
              selected={draft.affiliates ?? []}
              currentAdvertiserId={advertiser.id}
              allAdvertisers={allAdvertisers}
              allSettings={allSettings}
              onChange={affs => update({ affiliates: affs.length ? affs : null })}
            />
          </TabsContent>

          {/* Overrides tab — per-country cap overrides */}
          <TabsContent value="overrides" className="m-3 sm:m-6">
            <CountryCapsCard
              selected={draft.countries ?? []}
              countryCaps={countryCaps}
              onChange={setCountryCaps}
            />
          </TabsContent>

          {/* Review tab — read-only summary of everything before saving */}
          <TabsContent value="review" className="m-3 sm:m-6">
            <Card>
              <CardHeader>
                <CardTitle>Review configuration</CardTitle>
                <CardDescription>Confirm everything below before saving.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Daily cap</p>
                    <p className="text-lg font-semibold">{draft.default_daily_cap ?? "No limit"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Hourly cap</p>
                    <p className="text-lg font-semibold">{draft.default_hourly_cap ?? "No limit"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Base weight</p>
                    <p className="text-lg font-semibold">{draft.base_weight ?? 100}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">Countries</p>
                  <p className="text-sm text-muted-foreground">
                    {!draft.countries?.length
                      ? "All countries"
                      : draft.countries
                          .map(code => (countryData as Record<string, { name: string }>)[code]?.name ?? code)
                          .join(", ")}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">Affiliates</p>
                  <p className="text-sm text-muted-foreground">
                    {!draft.affiliates?.length
                      ? "All affiliates"
                      : draft.affiliates
                          .map(id => affiliates.find(a => a.id === id)?.name ?? id)
                          .join(", ")}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">Working hours</p>
                  <p className="text-sm text-muted-foreground">
                    {heatmap.matrix.flat().filter(Boolean).length} active hours/week · Timezone {heatmap.timezone}
                    {heatmap.smart_pacing && " · Smart pacing on"}
                    {heatmap.soft_cap_pct != null && ` · Soft-cap warning at ${heatmap.soft_cap_pct}%`}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">Per-country overrides</p>
                  {Object.keys(countryCaps).length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <ul className="text-sm text-muted-foreground space-y-0.5">
                      {Object.entries(countryCaps).map(([code, cap]) => (
                        <li key={code}>
                          {code} — {cap}/day
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Navigation footer — sticky so it stays at the bottom of the scroll area.
              Save is only reachable from the Review step, after walking through every section. */}
          <div className="sticky bottom-0 z-10 bg-background border-t px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setStepIndex(i => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
            >
              Back
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button
                onClick={() => setStepIndex(i => Math.min(STEPS.length - 1, i + 1))}
                disabled={!stepValidity[STEPS[stepIndex].id]}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>

        </div>
      </Tabs>
    </div>
  );
}

function SmartPacingInfo({
  cap,
  heatmap,
  todayCount,
}: {
  cap: number;
  heatmap: HeatmapConfig;
  todayCount: number;
}) {
  const activeHours = useMemo(() => heatmap.matrix.flat().filter(Boolean).length, [heatmap.matrix]);
  const now = new Date();
  const dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const currentHour = now.getHours();

  const remainingHoursToday = useMemo(() => {
    let count = 0;
    for (let h = currentHour; h < 24; h++) {
      if (heatmap.matrix[dayIdx]?.[h]) count++;
    }
    return count;
  }, [heatmap.matrix, dayIdx, currentHour]);

  const activeHoursPerDay = useMemo(() => {
    let total = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmap.matrix[d]?.[h]) total++;
      }
    }
    return Math.round(total / 7);
  }, [heatmap.matrix]);

  const leadsPerHour = activeHoursPerDay > 0 ? Math.ceil(cap / activeHoursPerDay) : cap;
  const remaining = cap - todayCount;
  const targetPerRemainingHour =
    remainingHoursToday > 0 ? Math.ceil(remaining / remainingHoursToday) : 0;

  return (
    <div className="grid grid-cols-3 gap-3 text-center text-sm">
      <div className="rounded-lg border p-2">
        <p className="text-xs text-muted-foreground">Avg per active hour</p>
        <p className="text-lg font-bold">{leadsPerHour}</p>
      </div>
      <div className="rounded-lg border p-2">
        <p className="text-xs text-muted-foreground">Remaining today</p>
        <p className="text-lg font-bold">{remaining}</p>
      </div>
      <div className="rounded-lg border p-2">
        <p className="text-xs text-muted-foreground">Target/hr now</p>
        <p className="text-lg font-bold">{targetPerRemainingHour}</p>
      </div>
    </div>
  );
}

function CountriesCard({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const allEntries = Object.entries(countryData);
  const filtered = search
    ? allEntries.filter(
        ([code, c]) =>
          code.toLowerCase().includes(search.toLowerCase()) ||
          c.name.toLowerCase().includes(search.toLowerCase())
      )
    : allEntries;

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Countries allow-list <span className="text-destructive">*</span></span>
          <Badge variant={selected.length === 0 ? "destructive" : "secondary"} className="max-w-[240px] truncate block text-right">
            {selected.length === 0
              ? "None selected"
              : selected.length <= 6
              ? selected.join(", ")
              : `${selected.slice(0, 6).join(", ")} +${selected.length - 6} more`}
          </Badge>
        </CardTitle>
        <CardDescription>
          Select at least one country. Search to filter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            disabled={selected.length === 0}
            onClick={() => onChange([])}
          >
            Clear all
          </Button>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map(code => (
              <Badge
                key={code}
                variant="secondary"
                className="h-6 px-1.5 text-xs font-mono flex items-center gap-1"
              >
                {code}
                <button
                  type="button"
                  className="cursor-pointer hover:text-destructive"
                  onClick={() => toggle(code)}
                  aria-label={`Remove ${code}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <ScrollArea className="h-48 rounded border">
          <div className="grid grid-cols-2 gap-1 p-2">
            {filtered.map(([code, country]) => (
              <div
                key={code}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer"
                onClick={() => toggle(code)}
              >
                <Checkbox checked={selected.includes(code)} />
                <span className="text-xs font-medium">{code}</span>
                <span className="text-xs text-muted-foreground truncate">{country.name}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AffiliatesCard({
  affiliates,
  selected,
  onChange,
  currentAdvertiserId,
  allAdvertisers,
  allSettings,
}: {
  affiliates: Affiliate[];
  selected: string[];
  onChange: (v: string[]) => void;
  currentAdvertiserId: string;
  allAdvertisers: Advertiser[];
  allSettings: DistSetting[];
}) {
  const [copyFromId, setCopyFromId] = useState("");
  const [search, setSearch] = useState("");

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(a => a !== id) : [...selected, id]);
  };

  const handleCopyFrom = () => {
    if (!copyFromId) return;
    const src = allSettings.find(s => s.advertiser_id === copyFromId);
    if (src?.affiliates?.length) {
      onChange([...new Set([...selected, ...src.affiliates])]);
    }
    setCopyFromId("");
  };

  const otherAdvertisers = allAdvertisers.filter(a => a.id !== currentAdvertiserId && a.is_active);
  const filtered = search
    ? affiliates.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : affiliates;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Affiliates allow-list <span className="text-destructive">*</span></span>
          <Badge variant={selected.length === 0 ? "destructive" : "secondary"}>
            {selected.length === 0 ? "None selected" : selected.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Select at least one affiliate. Search to filter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search affiliates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button size="sm" variant="outline" className="h-8" onClick={() => onChange([])}>
            Clear all
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => onChange(affiliates.map(a => a.id))}>
            Select all
          </Button>
          {/* Copy from another advertiser */}
          <div className="flex gap-1 sm:ml-auto">
            <Select value={copyFromId} onValueChange={setCopyFromId}>
              <SelectTrigger className="h-8 w-36 sm:w-44 text-xs">
                <SelectValue placeholder="Copy from…" />
              </SelectTrigger>
              <SelectContent>
                {otherAdvertisers.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              disabled={!copyFromId}
              onClick={handleCopyFrom}
              title="Copy affiliate list from selected advertiser"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-48 rounded border">
          <div className="space-y-1 p-2">
            {filtered.map(affiliate => (
              <div
                key={affiliate.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                onClick={() => toggle(affiliate.id)}
              >
                <Checkbox checked={selected.includes(affiliate.id)} />
                <span className="text-sm truncate flex-1">{affiliate.name}</span>
                {!affiliate.is_active && (
                  <Badge variant="secondary" className="text-xs">Inactive</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function CountryCapsCard({
  selected,
  countryCaps,
  onChange,
}: {
  selected: string[];
  countryCaps: Record<string, number>;
  onChange: (caps: Record<string, number>) => void;
}) {
  const [addCode, setAddCode] = useState("");
  const [addCap, setAddCap] = useState("");
  const { isRestricted } = useRestrictedCountries();

  const applicableCountries = selected.length > 0 ? selected : [];
  const allCountryCodes = Object.keys(countryData).filter(c => !isRestricted(c));
  const availableToAdd = (applicableCountries.length > 0 ? applicableCountries : allCountryCodes)
    .filter(c => !countryCaps[c] && !isRestricted(c));

  const handleAdd = () => {
    const cap = parseInt(addCap);
    if (!addCode || !cap || cap <= 0) return;
    onChange({ ...countryCaps, [addCode]: cap });
    setAddCode("");
    setAddCap("");
  };

  const handleRemove = (code: string) => {
    const next = { ...countryCaps };
    delete next[code];
    onChange(next);
  };

  const handleEdit = (code: string, value: string) => {
    const cap = parseInt(value);
    if (!cap || cap <= 0) return;
    onChange({ ...countryCaps, [code]: cap });
  };

  const entries = Object.entries(countryCaps).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sliders className="h-4 w-4" />
          Per-Country Cap Overrides
          {entries.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{entries.length} override{entries.length !== 1 ? "s" : ""}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Override the global daily cap for specific countries. Overrides take precedence over the advertiser-level cap.
          {selected.length === 0 && (
            <span className="block mt-1 text-yellow-600 text-xs">Tip: select countries in the Countries tab to filter the dropdown below.</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing overrides */}
        {entries.length > 0 ? (
          <div className="rounded-md border divide-y">
            {entries.map(([code, cap]) => (
              <div key={code} className="flex items-center gap-3 px-3 py-2">
                <span className="font-medium text-sm w-10 shrink-0">{code}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {(countryData as Record<string, {name:string}>)[code]?.name ?? code}
                </span>
                <Input
                  type="number"
                  min={1}
                  className="w-24 h-7 text-sm"
                  value={cap}
                  onChange={e => handleEdit(code, e.target.value)}
                />
                <span className="text-xs text-muted-foreground">/day</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(code)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm border rounded-md">
            No per-country overrides set. Add one below.
          </div>
        )}

        {/* Add new override */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px] space-y-1">
            <Label className="text-xs">Country</Label>
            <Select value={addCode} onValueChange={setAddCode}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select country…" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map(code => (
                  <SelectItem key={code} value={code} className="text-sm">
                    {code} — {(countryData as Record<string, {name:string}>)[code]?.name ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24 sm:w-28 space-y-1">
            <Label className="text-xs">Cap / day</Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 50"
              value={addCap}
              onChange={e => setAddCap(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={handleAdd} disabled={!addCode || !addCap}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
