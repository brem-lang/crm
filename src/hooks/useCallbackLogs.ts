import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCRMSettings } from "./useCRMSettings";

export interface CallbackLog {
  id: string;
  created_at: string;
  callback_type: string;
  processing_status: string;
  advertiser_id: string | null;
  advertiser_name: string | null;
  lead_id: string | null;
  injection_lead_id: string | null;
  matched_by: string | null;
  request_method: string;
  request_url: string | null;
  request_payload: Record<string, unknown> | null;
  request_headers: Record<string, unknown> | null;
  changes_applied: Record<string, unknown> | null;
  processing_error: string | null;
  processed_at: string | null;
  ip_address: string | null;
}

export function useCallbackLogs(limit: number = 100) {
  const { autoRefreshInterval } = useCRMSettings();
  const refetchMs = autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : false;

  return useQuery({
    queryKey: ['callback-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('callback_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as CallbackLog[];
    },
    staleTime: 30_000,
    refetchInterval: refetchMs,
  });
}

export function useCallbackLogsCount() {
  const { autoRefreshInterval } = useCRMSettings();
  const refetchMs = autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : false;

  return useQuery({
    queryKey: ['callback-logs-count'],
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('callback_logs')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: refetchMs,
  });
}
