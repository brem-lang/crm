import { useRef, useState, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Zap, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { businessHoursMatrix, emptyMatrix } from "@/lib/scheduleUtils";

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
}

interface ScheduleHeatmapProps {
  config: HeatmapConfig;
  volumeData?: number[][] | null; // [7][24] normalized 0-1
  onChange: (config: HeatmapConfig) => void;
}

export function ScheduleHeatmap({ config, volumeData, onChange }: ScheduleHeatmapProps) {
  const { matrix, timezone, smart_pacing, soft_cap_pct } = config;

  const isPainting = useRef(false);
  const paintValue = useRef(false);

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

  const handleMouseUp = () => { isPainting.current = false; };

  // Preset helpers
  const setAll = (val: boolean) =>
    update({ matrix: Array.from({ length: 7 }, () => Array(24).fill(val)) });

  const setWeekdays = () =>
    update({
      matrix: Array.from({ length: 7 }, (_, d) =>
        Array.from({ length: 24 }, (_, h) => d < 5 && matrix[d][h])
      ),
    });

  const setBusinessHours = () => update({ matrix: businessHoursMatrix() });

  // Active cell count
  const activeCount = matrix.flat().filter(Boolean).length;
  const hasVolume = !!volumeData;

  const groupedTimezones = TIMEZONE_OPTIONS.reduce((acc, tz) => {
    if (!acc[tz.group]) acc[tz.group] = [];
    acc[tz.group].push(tz);
    return acc;
  }, {} as Record<string, typeof TIMEZONE_OPTIONS>);

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Timezone */}
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={timezone} onValueChange={v => update({ timezone: v })}>
            <SelectTrigger className="h-7 text-xs w-44">
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

        <div className="flex gap-1 ml-auto">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAll(true)}>
            All on
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAll(false)}>
            Clear
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={setWeekdays}>
            Weekdays
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={setBusinessHours}>
            9–17
          </Button>
        </div>

        <Badge variant="secondary" className="text-xs">
          {activeCount} / 168 hrs
        </Badge>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full select-none">
          {/* Hour headers */}
          <div className="flex ml-10 mb-0.5">
            {HOURS.map(h => (
              <div
                key={h}
                className="text-center text-[10px] text-muted-foreground leading-none"
                style={{ width: 22, flexShrink: 0 }}
              >
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {DAYS.map((day, di) => (
            <div key={day} className="flex items-center mb-0.5">
              {/* Day label */}
              <div className="text-[10px] font-medium text-muted-foreground w-10 shrink-0 pr-1 text-right">
                {day}
              </div>

              {/* Cells */}
              {HOURS.map(h => {
                const active = matrix[di]?.[h] ?? false;
                const vol = volumeData?.[di]?.[h] ?? 0;

                return (
                  <div
                    key={h}
                    className={cn(
                      "rounded-[2px] cursor-pointer border border-background transition-colors relative",
                      active
                        ? "bg-primary hover:bg-primary/80"
                        : "bg-muted hover:bg-muted/70"
                    )}
                    style={{
                      width: 22,
                      height: 20,
                      flexShrink: 0,
                    }}
                    title={`${day} ${String(h).padStart(2, "0")}:00${vol > 0 ? ` · volume ${Math.round(vol * 100)}%` : ""}`}
                    onMouseDown={e => { e.preventDefault(); handleMouseDown(di, h); }}
                    onMouseEnter={() => handleMouseEnter(di, h)}
                  >
                    {/* Volume overlay */}
                    {vol > 0 && (
                      <div
                        className={cn(
                          "absolute inset-0 rounded-[2px]",
                          active ? "bg-white" : "bg-blue-400"
                        )}
                        style={{ opacity: active ? vol * 0.25 : vol * 0.6 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Volume legend */}
          {hasVolume && (
            <div className="flex items-center gap-2 mt-2 ml-10 text-[10px] text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-blue-400 opacity-60" />
              <span>Volume overlay (last 30 days)</span>
            </div>
          )}
        </div>
      </div>

      {/* Smart pacing & soft cap */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm">Smart pacing</Label>
            </div>
            <Switch
              checked={smart_pacing}
              onCheckedChange={v => update({ smart_pacing: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Spread the daily cap evenly across active hours instead of first-come-first-served.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-sm">Soft-cap warning</Label>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={99}
              placeholder="e.g. 80"
              value={soft_cap_pct ?? ""}
              onChange={e =>
                update({ soft_cap_pct: e.target.value ? parseInt(e.target.value) : null })
              }
              className="h-8 w-24 text-sm"
            />
            <span className="text-xs text-muted-foreground">% of daily cap</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Alert when this advertiser reaches the threshold.
          </p>
        </div>
      </div>
    </div>
  );
}
