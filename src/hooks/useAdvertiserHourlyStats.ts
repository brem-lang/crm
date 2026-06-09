import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Returns a normalized [7][24] matrix where day 0=Monday, value 0-1.
export function useAdvertiserHourlyStats(advertiserId: string, timezone = "UTC") {
  return useQuery({
    queryKey: ["advertiser-hourly-stats", advertiserId, timezone],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from("lead_distributions")
        .select("created_at")
        .eq("advertiser_id", advertiserId)
        .gte("created_at", since.toISOString())
        .eq("status", "sent");

      if (error) throw error;

      const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

      for (const row of data || []) {
        const utc = new Date(row.created_at);
        // Convert to advertiser local time
        const local = new Date(utc.toLocaleString("en-US", { timeZone: timezone }));
        const hour = local.getHours();
        const jsDay = local.getDay(); // 0 = Sunday
        const day = jsDay === 0 ? 6 : jsDay - 1; // remap to Mon=0 … Sun=6
        counts[day][hour]++;
      }

      const max = Math.max(...counts.flat(), 1);
      return counts.map(row => row.map(v => v / max));
    },
    enabled: !!advertiserId,
    staleTime: 5 * 60 * 1000,
  });
}
