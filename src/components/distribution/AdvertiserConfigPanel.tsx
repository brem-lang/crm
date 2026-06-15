import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Clock, Globe, Sliders, Zap, Bell, Copy, Trash2, Plus } from "lucide-react";
import { ScheduleHeatmap, type HeatmapConfig } from "./ScheduleHeatmap";
import { countryData } from "@/components/advertisers/countryData";
import {
  isHeatmapSchedule,
  legacyScheduleToMatrix,
  emptyMatrix,
} from "@/lib/scheduleUtils";
import type { WeeklySchedule } from "./WeeklyScheduleSelector";
import { useAdvertiserHourlyStats } from "@/hooks/useAdvertiserHourlyStats";

const REGION_PRESETS: Record<string, { label: string; codes: string[] }> = {
  tier1: { label: "Tier 1", codes: ["US", "GB", "CA", "AU", "NZ", "DE", "FR", "NL", "SE", "NO", "DK", "FI", "CH", "AT", "BE", "IE"] },
  gcc: { label: "GCC", codes: ["AE", "SA", "QA", "KW", "BH", "OM"] },
  latam: { label: "LATAM", codes: ["BR", "MX", "AR", "CO", "CL", "PE", "UY", "PY", "BO", "EC", "DO", "PR", "GT", "HN", "SV", "CR", "PA"] },
  apac: { label: "APAC", codes: ["JP", "KR", "SG", "HK", "TW", "TH", "MY", "ID", "PH", "VN", "IN", "PK", "BD"] },
  mea: { label: "MEA", codes: ["ZA", "NG", "KE", "EG", "MA", "GH", "TZ", "ET", "TN", "DZ", "CI", "SN", "UG", "CM"] },
};

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
    <div className="flex flex-col h-full">
      {/* Panel header — pr-14 keeps content clear of the Dialog's absolute X button */}
      <div className="pl-6 pr-14 py-4 border-b flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold">{advertiser.name}</h2>
          <p className="text-sm text-muted-foreground">{advertiser.advertiser_type}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="adv-active" className="text-sm">Active</Label>
            <Switch
              id="adv-active"
              checked={draft.is_active}
              onCheckedChange={v => update({ is_active: v })}
              disabled={!advertiser.is_active}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="caps" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-4 w-fit shrink-0">
          <TabsTrigger value="caps" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Caps & Pacing
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="geo" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Countries & Affiliates
          </TabsTrigger>
          <TabsTrigger value="overrides" className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Overrides
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Caps & Pacing tab */}
          <TabsContent value="caps" className="m-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily & Hourly Caps</CardTitle>
                <CardDescription>Maximum leads accepted per time period.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Daily cap */}
                <div className="flex items-start gap-4">
                  <div className="space-y-1 flex-1 max-w-xs">
                    <Label>Daily cap</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="No limit"
                      value={draft.default_daily_cap ?? ""}
                      onChange={e =>
                        update({ default_daily_cap: e.target.value ? parseInt(e.target.value) : null })
                      }
                    />
                  </div>
                  {cap != null && (
                    <div className="pt-6">
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
                  <Label>Hourly cap</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={draft.default_hourly_cap ?? ""}
                    onChange={e =>
                      update({ default_hourly_cap: e.target.value ? parseInt(e.target.value) : null })
                    }
                  />
                </div>

                {/* Base weight */}
                <div className="space-y-1 max-w-xs">
                  <Label>Base weight</Label>
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
                  Configure in the Schedule tab.
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
                  Alert when this advertiser reaches the threshold. Configure in the Schedule tab.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          {/* Schedule tab — 7×24 heatmap */}
          <TabsContent value="schedule" className="m-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>
                  Click or drag cells to toggle active hours. Blue overlay shows actual received
                  volume (last 30 days). Smart pacing and soft-cap are saved with the schedule.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScheduleHeatmap
                  config={heatmap}
                  volumeData={volumeData}
                  onChange={setHeatmap}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Countries & Affiliates tab */}
          <TabsContent value="geo" className="m-6 space-y-4">
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
          <TabsContent value="overrides" className="m-6">
            <CountryCapsCard
              selected={draft.countries ?? []}
              countryCaps={countryCaps}
              onChange={setCountryCaps}
            />
          </TabsContent>

        </ScrollArea>
      </Tabs>

      {/* Footer */}
      <div className="px-6 py-4 border-t flex items-center justify-end shrink-0">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
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

  const applyPreset = (codes: string[]) => {
    const allIn = codes.every(c => selected.includes(c));
    if (allIn) {
      onChange(selected.filter(c => !codes.includes(c)));
    } else {
      const next = new Set([...selected, ...codes]);
      onChange([...next]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Countries allow-list
          <Badge variant="secondary">{selected.length || "All"}</Badge>
        </CardTitle>
        <CardDescription>
          Leave empty to accept all countries. Use presets or search to restrict.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Region preset buttons */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(REGION_PRESETS).map(([key, preset]) => {
            const allIn = preset.codes.every(c => selected.includes(c));
            return (
              <Button
                key={key}
                size="sm"
                variant={allIn ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => applyPreset(preset.codes)}
              >
                {preset.label}
                <span className="ml-1 opacity-60 text-xs">({preset.codes.length})</span>
              </Button>
            );
          })}
          {selected.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange([])}>
              Clear all
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Affiliates allow-list
          <Badge variant="secondary">{selected.length || "All"}</Badge>
        </CardTitle>
        <CardDescription>
          Leave empty to accept leads from all affiliates. Select specific affiliates to restrict.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-8" onClick={() => onChange([])}>
            Clear all
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => onChange(affiliates.map(a => a.id))}>
            Select all
          </Button>
          {/* Copy from another advertiser */}
          <div className="flex gap-1 ml-auto">
            <Select value={copyFromId} onValueChange={setCopyFromId}>
              <SelectTrigger className="h-8 w-44 text-xs">
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
            {affiliates.map(affiliate => (
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

  const applicableCountries = selected.length > 0 ? selected : [];
  const allCountryCodes = Object.keys(countryData);
  const availableToAdd = (applicableCountries.length > 0 ? applicableCountries : allCountryCodes)
    .filter(c => !countryCaps[c]);

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
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
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
          <div className="w-28 space-y-1">
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
