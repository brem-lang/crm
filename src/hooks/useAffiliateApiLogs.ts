import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCRMSettings } from "@/hooks/useCRMSettings";

export interface AffiliateApiLog {
  id: string;
  affiliate_id: string | null;
  api_key_hint: string | null;
  request_ip: string | null;
  payload: Record<string, unknown> | null;
  status: 'accepted' | 'rejected';
  reason: string | null;
  created_at: string;
  affiliates: { name: string } | null;
}

interface UseAffiliateApiLogsParams {
  page?: number;
  affiliateId?: string;
  status?: 'accepted' | 'rejected' | '';
  dateFrom?: string;
  dateTo?: string;
  ipSearch?: string;
}

export function useAffiliateApiLogs({
  page = 1,
  affiliateId,
  status,
  dateFrom,
  dateTo,
  ipSearch,
}: UseAffiliateApiLogsParams = {}) {
  const { defaultPageSize } = useCRMSettings();
  const pageSize = defaultPageSize || 25;

  return useQuery({
    queryKey: ['affiliate-api-logs', page, affiliateId, status, dateFrom, dateTo, ipSearch],
    queryFn: async () => {
      let query = supabase
        .from('affiliate_api_logs')
        .select('*, affiliates(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (affiliateId) query = query.eq('affiliate_id', affiliateId);
      if (status) query = query.eq('status', status);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);
      if (ipSearch) query = query.ilike('request_ip', `%${ipSearch}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: (data as AffiliateApiLog[]) ?? [], total: count ?? 0, pageSize };
    },
    staleTime: 30 * 1000,
  });
}
