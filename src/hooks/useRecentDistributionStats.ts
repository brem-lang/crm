import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRecentDistributionStats(days = 7) {
  return useQuery({
    queryKey: ["recent-distribution-stats", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("lead_distributions")
        .select("advertiser_id")
        .gte("created_at", since.toISOString())
        .eq("status", "sent");

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.advertiser_id] = (counts[row.advertiser_id] || 0) + 1;
      }
      // Convert to daily average
      const averages: Record<string, number> = {};
      for (const [id, total] of Object.entries(counts)) {
        averages[id] = Math.round(total / days);
      }
      return averages;
    },
    staleTime: 5 * 60 * 1000,
  });
}
