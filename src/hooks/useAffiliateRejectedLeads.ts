import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseAffiliateRejectedLeadsOptions {
  page: number;
  pageSize: number;
  affiliateId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useAffiliateRejectedLeads(options: UseAffiliateRejectedLeadsOptions) {
  return useQuery({
    queryKey: ["affiliate-rejected-leads", options],
    queryFn: async () => {
      const { page, pageSize, affiliateId, dateFrom, dateTo } = options;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("leads")
        .select(
          `
          id,
          request_id,
          firstname,
          lastname,
          email,
          mobile,
          country_code,
          country,
          ip_address,
          offer_name,
          affiliate_id,
          created_at,
          affiliates(name),
          lead_distributions(status, response, advertisers(name))
        `,
          { count: "exact" }
        )
        .eq("status", "rejected")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (affiliateId) query = query.eq("affiliate_id", affiliateId);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { leads: data ?? [], total: count ?? 0 };
    },
    staleTime: 30 * 1000,
  });
}
