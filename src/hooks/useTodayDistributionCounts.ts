import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTodayDistributionCounts() {
  return useQuery({
    queryKey: ['today-distribution-counts'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('lead_distributions')
        .select('advertiser_id')
        .gte('created_at', today.toISOString())
        .eq('status', 'sent');

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.advertiser_id] = (counts[row.advertiser_id] || 0) + 1;
      }
      return counts;
    },
    refetchInterval: 30_000,
  });
}
