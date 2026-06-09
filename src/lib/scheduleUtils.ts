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
