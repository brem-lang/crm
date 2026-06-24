import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCRMSettings } from "./useCRMSettings";

export interface LiveTelemetry {
  leadsPerMin: number;
  lastHourCounts: Record<string, number>;
  rejectionRate: number;
  totalLastHour: number;
}

export function useLiveTelemetry() {
  const { autoRefreshInterval } = useCRMSettings();
  const refetchMs = autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : false;

  return useQuery<LiveTelemetry>({
    queryKey: ["live-telemetry"],
    queryFn: async () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [recentRes, hourRes] = await Promise.all([
        supabase
          .from("lead_distributions")
          .select("status")
          .gte("created_at", fiveMinAgo.toISOString())
          .in("status", ["sent", "failed"]),
        supabase
          .from("lead_distributions")
          .select("advertiser_id, status")
          .gte("created_at", oneHourAgo.toISOString())
          .in("status", ["sent", "failed"]),
      ]);

      if (recentRes.error) throw recentRes.error;
      if (hourRes.error) throw hourRes.error;

      const recentSent = (recentRes.data || []).filter(r => r.status === "sent").length;
      const leadsPerMin = Math.round((recentSent / 5) * 10) / 10;

      const lastHourCounts: Record<string, number> = {};
      let totalSent = 0;
      let totalFailed = 0;

      for (const row of hourRes.data || []) {
        if (row.status === "sent") {
          lastHourCounts[row.advertiser_id] = (lastHourCounts[row.advertiser_id] || 0) + 1;
          totalSent++;
        } else {
          totalFailed++;
        }
      }

      const totalAttempted = totalSent + totalFailed;
      const rejectionRate = totalAttempted > 0 ? totalFailed / totalAttempted : 0;

      return { leadsPerMin, lastHourCounts, rejectionRate, totalLastHour: totalSent };
    },
    refetchInterval: refetchMs,
  });
}
