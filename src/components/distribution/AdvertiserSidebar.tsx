import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeeklySchedule } from "./WeeklyScheduleSelector";

interface Advertiser {
  id: string;
  name: string;
  is_active: boolean;
  advertiser_type: string;
}

interface DistSetting {
  advertiser_id: string;
  is_active: boolean;
  default_daily_cap: number | null;
  default_hourly_cap: number | null;
  start_time: string | null;
  end_time: string | null;
  weekly_schedule?: unknown;
}

type AdvertiserStatus = "active" | "paused" | "capped" | "outside-hours";

const STATUS_ORDER: AdvertiserStatus[] = ["active", "outside-hours", "capped", "paused"];

const STATUS_META: Record<AdvertiserStatus, { label: string; dot: string; text: string }> = {
  active: { label: "Active", dot: "bg-green-500", text: "text-green-600" },
  "outside-hours": { label: "Outside Hours", dot: "bg-yellow-400", text: "text-yellow-600" },
  capped: { label: "Capped Today", dot: "bg-orange-500", text: "text-orange-600" },
  paused: { label: "Paused", dot: "bg-gray-400", text: "text-gray-500" },
};

function getStatus(
  advertiser: Advertiser,
  setting: DistSetting | null,
  todayCount: number
): AdvertiserStatus {
  if (!advertiser.is_active || !setting?.is_active) return "paused";
  if (setting.default_daily_cap != null && todayCount >= setting.default_daily_cap) return "capped";

  const now = new Date();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  const todayKey = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (setting.weekly_schedule) {
    const ws = setting.weekly_schedule as any;
    if (ws.format === "heatmap") {
      const hour = now.getHours();
      const jsDay = now.getDay();
      const day = jsDay === 0 ? 6 : jsDay - 1;
      if (!ws.matrix[day]?.[hour]) return "outside-hours";
    } else {
      const day = (ws as WeeklySchedule)[todayKey];
      if (!day?.is_active) return "outside-hours";
      const start = day.start_time || "00:00";
      const end = day.end_time || "23:59";
      if (currentTime < start || currentTime > end) return "outside-hours";
    }
  } else {
    const start = setting.start_time || "00:00";
    const end = setting.end_time || "23:59";
    if (currentTime < start || currentTime > end) return "outside-hours";
  }

  return "active";
}

interface AdvertiserSidebarProps {
  advertisers: Advertiser[];
  settings: DistSetting[];
  todayCounts: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  // multi-select
  bulkSelectMode: boolean;
  bulkSelectedIds: Set<string>;
  onBulkSelectChange: (ids: Set<string>) => void;
}

export function AdvertiserSidebar({
  advertisers,
  settings,
  todayCounts,
  selectedId,
  onSelect,
  bulkSelectMode,
  bulkSelectedIds,
  onBulkSelectChange,
}: AdvertiserSidebarProps) {
  const [search, setSearch] = useState("");

  const settingMap = useMemo(() => {
    const m: Record<string, DistSetting> = {};
    for (const s of settings) m[s.advertiser_id] = s;
    return m;
  }, [settings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return advertisers.filter(
      a => !q || a.name.toLowerCase().includes(q) || a.advertiser_type.toLowerCase().includes(q)
    );
  }, [advertisers, search]);

  const grouped = useMemo(() => {
    const groups: Record<AdvertiserStatus, Advertiser[]> = {
      active: [],
      "outside-hours": [],
      capped: [],
      paused: [],
    };
    for (const a of filtered) {
      const status = getStatus(a, settingMap[a.id] ?? null, todayCounts[a.id] ?? 0);
      groups[status].push(a);
    }
    return groups;
  }, [filtered, settingMap, todayCounts]);

  const toggleBulk = (id: string) => {
    const next = new Set(bulkSelectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onBulkSelectChange(next);
  };

  const toggleAll = () => {
    if (bulkSelectedIds.size === filtered.length) {
      onBulkSelectChange(new Set());
    } else {
      onBulkSelectChange(new Set(filtered.map(a => a.id)));
    }
  };

  return (
    <div className="flex flex-col h-full border-r bg-muted/20">
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search advertisers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {bulkSelectMode && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={toggleAll}
          >
            {bulkSelectedIds.size === filtered.length ? "Deselect all" : `Select all (${filtered.length})`}
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {STATUS_ORDER.map(status => {
            const items = grouped[status];
            if (!items.length) return null;
            const meta = STATUS_META[status];

            return (
              <div key={status}>
                <div className="px-2 pb-1 flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
                  <span className={cn("text-xs font-semibold uppercase tracking-wide", meta.text)}>
                    {meta.label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
                </div>

                <div className="space-y-0.5">
                  {items.map(advertiser => {
                    const setting = settingMap[advertiser.id];
                    const count = todayCounts[advertiser.id] ?? 0;
                    const cap = setting?.default_daily_cap ?? null;
                    const pct = cap ? Math.min(100, (count / cap) * 100) : 0;
                    const isSelected = !bulkSelectMode && selectedId === advertiser.id;
                    const isBulkChecked = bulkSelectedIds.has(advertiser.id);

                    return (
                      <button
                        key={advertiser.id}
                        onClick={() => {
                          if (bulkSelectMode) toggleBulk(advertiser.id);
                          else onSelect(isSelected ? null : advertiser.id);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : isBulkChecked
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {bulkSelectMode && (
                            <Checkbox
                              checked={isBulkChecked}
                              className="shrink-0"
                              onClick={e => e.stopPropagation()}
                              onCheckedChange={() => toggleBulk(advertiser.id)}
                            />
                          )}
                          {!bulkSelectMode && (
                            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", meta.dot)} />
                          )}
                          <span className="text-sm font-medium truncate flex-1">
                            {advertiser.name}
                          </span>
                        </div>
                        {cap != null && (
                          <div className="mt-1.5 pl-4">
                            <Progress value={pct} className="h-1" />
                            <span className="text-xs text-muted-foreground mt-0.5 block">
                              {count} / {cap} today
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No advertisers match "{search}"
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
