import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DryRunLead {
  country_code: string;
  affiliate_id: string;
  actual_advertiser_id: string;
}

export function useDryRunLeads(limit = 1000) {
  return useQuery({
    queryKey: ["dry-run-leads", limit],
    queryFn: async () => {
      // Fetch recent sent distributions joined with leads for country_code
      const { data, error } = await supabase
        .from("lead_distributions")
        .select(`
          advertiser_id,
          affiliate_id,
          leads!lead_distributions_lead_id_fkey(country_code)
        `)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || [])
        .map((row: any) => ({
          country_code: row.leads?.country_code ?? "",
          affiliate_id: row.affiliate_id ?? "",
          actual_advertiser_id: row.advertiser_id,
        }))
        .filter((r: DryRunLead) => r.country_code) as DryRunLead[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: false, // only run when explicitly triggered
  });
}
