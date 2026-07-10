import type { WeeklySchedule } from "@/components/distribution/WeeklyScheduleSelector";

const DAY_KEYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

// Heatmap format: matrix[7][24], day 0=Monday
export interface HeatmapSchedule {
  format: "heatmap";
  matrix: boolean[][];
  timezone: string;
  smart_pacing?: boolean;
  soft_cap_pct?: number | null;
  country_caps?: Record<string, number>;
  custom_days?: boolean[];
  from_hour?: number;
  to_hour?: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function isHeatmapSchedule(ws: unknown): ws is HeatmapSchedule {
  return typeof ws === "object" && ws !== null && (ws as any).format === "heatmap";
}

export function isWithinSchedule(
  setting: {
    start_time?: string | null;
    end_time?: string | null;
    weekly_schedule?: unknown;
  },
  at: Date = new Date()
): boolean {
  const ws = setting.weekly_schedule;

  // New heatmap format
  if (isHeatmapSchedule(ws)) {
    const tz = ws.timezone || "UTC";
    const local = tz === "UTC" ? at : new Date(at.toLocaleString("en-US", { timeZone: tz }));
    const hour = local.getHours();
    const jsDay = local.getDay(); // 0=Sunday
    const day = jsDay === 0 ? 6 : jsDay - 1; // Mon=0…Sun=6
    return ws.matrix[day]?.[hour] === true;
  }

  // Legacy per-day WeeklySchedule format
  if (ws && typeof ws === "object" && !Array.isArray(ws)) {
    const legacyWs = ws as WeeklySchedule;
    const dayKey = DAY_KEYS[at.getDay()];
    const currentMinutes = at.getHours() * 60 + at.getMinutes();
    const day = legacyWs[dayKey as keyof WeeklySchedule];
    if (!day?.is_active) return false;
    const start = timeToMinutes(day.start_time || "00:00");
    const end = timeToMinutes(day.end_time || "23:59");
    return currentMinutes >= start && currentMinutes <= end;
  }

  // Fallback: simple start_time / end_time
  const currentMinutes = at.getHours() * 60 + at.getMinutes();
  const start = timeToMinutes(setting.start_time || "00:00");
  const end = timeToMinutes(setting.end_time || "23:59");
  return currentMinutes >= start && currentMinutes <= end;
}

function hourLabel(h: number): string {
  return `${String(h % 24).padStart(2, "0")}:00`;
}

// Compact "Mon-Fri 09:00–17:00"-style summary for the Advertiser Config
// table's Working Hours column, covering all three schedule shapes:
// heatmap matrix, legacy per-day WeeklySchedule, and plain start/end time.
export function summarizeWorkingHours(setting: {
  start_time?: string | null;
  end_time?: string | null;
  weekly_schedule?: unknown;
} | null | undefined): string {
  if (!setting) return "24/7";
  const ws = setting.weekly_schedule;

  if (isHeatmapSchedule(ws)) {
    const { matrix, timezone } = ws;
    const tzSuffix = timezone && timezone !== "UTC" ? ` (${timezone})` : "";
    const activeRows = matrix.filter(row => row.some(Boolean));
    if (activeRows.length === 0) return "All days off";

    const first = activeRows[0];
    const allSame = activeRows.every(row => row.every((v, h) => v === first[h]));
    const hoursFor = (row: boolean[]): string => {
      const hours = row.map((v, h) => (v ? h : -1)).filter(h => h >= 0);
      if (hours.length === row.length) return "24h";
      const contiguous = hours.every((h, idx) => h === hours[0] + idx);
      return contiguous ? `${hourLabel(hours[0])}–${hourLabel(hours[hours.length - 1] + 1)}` : "custom hours";
    };

    const isWeekdaysOnly =
      matrix[0].some(Boolean) && matrix[1].some(Boolean) && matrix[2].some(Boolean) &&
      matrix[3].some(Boolean) && matrix[4].some(Boolean) &&
      !matrix[5].some(Boolean) && !matrix[6].some(Boolean);

    if (activeRows.length === 7 && allSame) {
      const hrs = hoursFor(first);
      return hrs === "24h" ? `24/7${tzSuffix}` : `Every day ${hrs}${tzSuffix}`;
    }
    if (isWeekdaysOnly && allSame) return `Mon-Fri ${hoursFor(first)}${tzSuffix}`;

    return `Custom (${activeRows.length} day${activeRows.length === 1 ? "" : "s"})${tzSuffix}`;
  }

  if (ws && typeof ws === "object" && !Array.isArray(ws)) {
    const legacyWs = ws as WeeklySchedule;
    const days: (keyof WeeklySchedule)[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const active = days.filter(d => legacyWs[d]?.is_active);
    if (active.length === 0) return "All days off";

    const isWeekdaysOnly = ["monday", "tuesday", "wednesday", "thursday", "friday"].every(d => legacyWs[d as keyof WeeklySchedule]?.is_active)
      && !legacyWs.saturday?.is_active && !legacyWs.sunday?.is_active;

    if (active.length === 7 || isWeekdaysOnly) {
      const times = active.map(d => legacyWs[d]);
      const firstStart = times[0].start_time;
      const firstEnd = times[0].end_time;
      const sameHours = times.every(t => t.start_time === firstStart && t.end_time === firstEnd);
      const label = active.length === 7 ? "Every day" : "Mon-Fri";
      return sameHours && firstStart && firstEnd ? `${label} ${firstStart.slice(0, 5)}–${firstEnd.slice(0, 5)}` : `${label} custom`;
    }

    const short: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
    return active.map(d => short[d]).join(", ");
  }

  const start = setting.start_time || "00:00";
  const end = setting.end_time || "23:59";
  if (start === "00:00" && (end === "23:59" || end === "24:00")) return "24/7";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

// Convert legacy WeeklySchedule → 7×24 boolean matrix (Mon=0)
export function legacyScheduleToMatrix(ws: WeeklySchedule): boolean[][] {
  const days: (keyof WeeklySchedule)[] = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  ];
  return days.map(day => {
    const d = ws[day];
    if (!d?.is_active) return Array(24).fill(false) as boolean[];
    const startH = Math.floor(timeToMinutes(d.start_time || "00:00") / 60);
    const endH = Math.ceil(timeToMinutes(d.end_time || "23:59") / 60);
    return Array.from({ length: 24 }, (_, h) => h >= startH && h < endH) as boolean[];
  });
}

export function emptyMatrix(): boolean[][] {
  return Array.from({ length: 7 }, () => Array(24).fill(false) as boolean[]);
}

export function businessHoursMatrix(): boolean[][] {
  return Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, h) => day < 5 && h >= 9 && h < 17)
  );
}

// days[0]=Mon … days[6]=Sun, toHour is exclusive (9–17 = hours 9..16 active)
export function customPatternMatrix(days: boolean[], fromHour: number, toHour: number): boolean[][] {
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => days[d] && h >= fromHour && h < toHour)
  );
}
