import React, { useRef, useState, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Zap, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { customPatternMatrix } from "@/lib/scheduleUtils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC", group: "Universal" },
  { value: "Europe/London", label: "London (GMT/BST)", group: "Europe" },
  { value: "Europe/Paris", label: "Paris (CET)", group: "Europe" },
  { value: "Europe/Berlin", label: "Berlin (CET)", group: "Europe" },
  { value: "Europe/Moscow", label: "Moscow (MSK)", group: "Europe" },
  { value: "America/New_York", label: "New York (EST)", group: "Americas" },
  { value: "America/Chicago", label: "Chicago (CST)", group: "Americas" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)", group: "Americas" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)", group: "Americas" },
  { value: "Asia/Dubai", label: "Dubai (GST)", group: "Asia/Pacific" },
  { value: "Asia/Jerusalem", label: "Jerusalem (IST)", group: "Asia/Pacific" },
  { value: "Asia/Kolkata", label: "Mumbai (IST)", group: "Asia/Pacific" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", group: "Asia/Pacific" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", group: "Asia/Pacific" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)", group: "Asia/Pacific" },
  { value: "Australia/Sydney", label: "Sydney (AEST)", group: "Asia/Pacific" },
  { value: "Africa/Cairo", label: "Cairo (EET)", group: "Africa" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)", group: "Africa" },
  { value: "Africa/Lagos", label: "Lagos (WAT)", group: "Africa" },
];

export interface HeatmapConfig {
  matrix: boolean[][];
  timezone: string;
  smart_pacing: boolean;
  soft_cap_pct: number | null;
  custom_days?: boolean[];
  from_hour?: number;
  to_hour?: number;
}

interface ScheduleHeatmapProps {
  config: HeatmapConfig;
  volumeData?: number[][] | null;
  onChange: (config: HeatmapConfig) => void;
}

export function ScheduleHeatmap({ config, volumeData, onChange }: ScheduleHeatmapProps) {
  const { matrix, timezone, smart_pacing, soft_cap_pct } = config;

  const isPainting = useRef(false);
  const paintValue = useRef(false);

  const [customDays, setCustomDays] = useState<boolean[]>(
    config.custom_days ?? [true, true, true, true, true, false, false]
  );
  const [fromHour, setFromHour] = useState(config.from_hour ?? 9);
  const [toHour, setToHour] = useState(config.to_hour ?? 17);

  const update = useCallback(
    (partial: Partial<HeatmapConfig>) => onChange({ ...config, ...partial }),
    [config, onChange]
  );

  const toggleCell = useCallback(
    (day: number, hour: number, value: boolean) => {
      const next = matrix.map(r => [...r]);
      next[day][hour] = value;
      update({ matrix: next });
    },
    [matrix, update]
  );

  const handleMouseDown = (day: number, hour: number) => {
    isPainting.current = true;
    paintValue.current = !matrix[day][hour];
    toggleCell(day, hour, paintValue.current);
  };

  const handleMouseEnter = (day: number, hour: number) => {
    if (!isPainting.current) return;
    toggleCell(day, hour, paintValue.current);
  };

  const handleMouseUp = useCallback(() => { isPainting.current = false; }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPainting.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el instanceof HTMLElement) {
      const day = el.dataset.day;
      const hour = el.dataset.hour;
      if (day !== undefined && hour !== undefined) {
        toggleCell(Number(day), Number(hour), paintValue.current);
      }
    }
  }, [toggleCell]);

  const setAll = (val: boolean) =>
    update({ matrix: Array.from({ length: 7 }, () => Array(24).fill(val) as boolean[]) });

  const applyPattern = () =>
    update({
      matrix: customPatternMatrix(customDays, fromHour, toHour),
      custom_days: customDays,
      from_hour: fromHour,
      to_hour: toHour,
    });

  const toggleDay = (i: number) =>
    setCustomDays(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const activeCount = matrix.flat().filter(Boolean).length;
  const hasVolume = !!volumeData;

  const groupedTimezones = TIMEZONE_OPTIONS.reduce((acc, tz) => {
    if (!acc[tz.group]) acc[tz.group] = [];
    acc[tz.group].push(tz);
    return acc;
  }, {} as Record<string, typeof TIMEZONE_OPTIONS>);

  const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i);

  // CSS grid column template: 32px day label + 24 equal-fraction cells
  // 1fr cells can NEVER overflow — they shrink with the container automatically
  const gridCols = "32px repeat(24, 1fr)";

  return (
    <div
      className="space-y-3 w-full min-w-0"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={timezone} onValueChange={v => update({ timezone: v })}>
            <SelectTrigger className="h-7 text-xs w-36 min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedTimezones).map(([group, tzs]) => (
                <div key={group}>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</div>
                  {tzs.map(tz => (
                    <SelectItem key={tz.value} value={tz.value} className="text-xs pl-4">
                      {tz.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setAll(true)}>All on</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setAll(false)}>Clear</Button>
          <Badge variant="secondary" className="text-xs h-7 px-2 flex items-center shrink-0">
            {activeCount}/168h
          </Badge>
        </div>
      </div>

      {/* ── Pattern builder ── */}
      <div className="rounded-lg bg-muted/40 border p-2 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground shrink-0">Days:</span>
          <div className="flex gap-1 flex-wrap">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => toggleDay(i)}
                className={cn(
                  "h-6 w-8 rounded text-[11px] font-medium border transition-colors",
                  customDays[i]
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground shrink-0">Hours:</span>
          <select
            value={fromHour}
            onChange={e => setFromHour(Number(e.target.value))}
            className="h-6 rounded border bg-background px-1 text-xs flex-1 min-w-0"
          >
            {HOUR_OPTIONS.slice(0, 24).map(h => (
              <option key={h} value={h} disabled={h >= toHour}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground shrink-0">–</span>
          <select
            value={toHour}
            onChange={e => setToHour(Number(e.target.value))}
            className="h-6 rounded border bg-background px-1 text-xs flex-1 min-w-0"
          >
            {HOUR_OPTIONS.slice(1).map(h => (
              <option key={h} value={h} disabled={h <= fromHour}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-6 text-xs px-3 shrink-0"
            onClick={applyPattern}
            disabled={!customDays.some(Boolean) || fromHour >= toHour}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* ── Heatmap grid ──
          Uses CSS grid with 1fr columns — cells proportionally fill available width,
          impossible to overflow regardless of the parent scroll container. */}
      <div
        className="w-full min-w-0 select-none"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Hour header row */}
        <div className="grid mb-0.5" style={{ gridTemplateColumns: gridCols }}>
          <div /> {/* corner spacer */}
          {HOURS.map(h => (
            <div
              key={h}
              className="text-center text-[10px] text-muted-foreground leading-none"
              style={{ minWidth: 0 }}
            >
              {h % 6 === 0 ? h : ""}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {DAYS.map((day, di) => (
          <React.Fragment key={day}>
            <div className="grid mb-[2px]" style={{ gridTemplateColumns: gridCols }}>
              <div className="text-[10px] font-medium text-muted-foreground text-right pr-1 self-center" style={{ minWidth: 0 }}>
                {day}
              </div>
              {HOURS.map(h => {
                const active = matrix[di]?.[h] ?? false;
                const vol = volumeData?.[di]?.[h] ?? 0;
                return (
                  <div
                    key={h}
                    data-day={di}
                    data-hour={h}
                    className={cn(
                      "rounded-[2px] cursor-pointer border border-background transition-colors relative",
                      active ? "bg-primary hover:bg-primary/80" : "bg-muted hover:bg-muted/70"
                    )}
                    style={{ minWidth: 0, height: 18 }}
                    title={`${day} ${String(h).padStart(2, "0")}:00${vol > 0 ? ` · ${Math.round(vol * 100)}%` : ""}`}
                    onMouseDown={e => { e.preventDefault(); handleMouseDown(di, h); }}
                    onMouseEnter={() => handleMouseEnter(di, h)}
                    onTouchStart={e => { e.preventDefault(); handleMouseDown(di, h); }}
                  >
                    {vol > 0 && (
                      <div
                        className={cn("absolute inset-0 rounded-[2px]", active ? "bg-white" : "bg-blue-400")}
                        style={{ opacity: active ? vol * 0.25 : vol * 0.6 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}

        {hasVolume && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground pl-8">
            <div className="w-3 h-3 rounded-sm bg-blue-400 opacity-60 shrink-0" />
            <span>Volume overlay (last 30 days)</span>
          </div>
        )}
      </div>

      {/* ── Smart pacing & Soft-cap ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t">
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Label className="text-sm font-medium">Smart pacing</Label>
            </div>
            <p className="text-xs text-muted-foreground">Spread cap evenly across active hours.</p>
          </div>
          <Switch
            checked={smart_pacing}
            onCheckedChange={v => update({ smart_pacing: v })}
            className="shrink-0 mt-0.5"
          />
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Label className="text-sm font-medium">Soft-cap warning</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={99}
                placeholder="e.g. 80"
                value={soft_cap_pct ?? ""}
                onChange={e => update({ soft_cap_pct: e.target.value ? parseInt(e.target.value) : null })}
                className="h-7 w-20 text-xs"
              />
              <span className="text-xs text-muted-foreground">% of cap</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
