import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRejectedLeads() {
  return useQuery({
    queryKey: ['rejected-leads'],
    queryFn: async () => {
      // Fetch leads with status 'rejected' along with their failed distributions
      const { data: rejectedStatusLeads, error: rejectedError } = await supabase
        .from('leads')
        .select(`
          id,
          request_id,
          firstname,
          lastname,
          email,
          mobile,
          country_code,
          country,
          city,
          ip_address,
          status,
          sale_status,
          offer_name,
          is_ftd,
          injection_ftd,
          ftd_date,
          ftd_id,
          affiliate_id,
          advertiser_id,
          autologin,
          user_agent,
          platform,
          browser,
          comment,
          custom1,
          custom2,
          custom3,
          custom4,
          custom5,
          live_lead_status,
          live_lead_score,
          created_at,
          distributed_at,
          affiliates(name),
          lead_distributions(
            id,
            advertiser_id,
            status,
            response,
            created_at,
            advertisers(name)
          )
        `)
        .eq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (rejectedError) throw rejectedError;

      // Also fetch from rejected_leads table (per-advertiser rejections)
      const { data: rejectedLeadsTable, error: tableError } = await supabase
        .from('rejected_leads')
        .select(`
          *,
          leads(
            firstname, lastname, email, mobile, country_code, country, city,
            ip_address, status, sale_status, offer_name, is_ftd, injection_ftd,
            ftd_date, ftd_id, affiliate_id, advertiser_id, autologin,
            user_agent, platform, browser, comment,
            custom1, custom2, custom3, custom4, custom5,
            live_lead_status, live_lead_score,
            request_id, created_at, distributed_at, affiliates(name)
          ),
          advertisers(name)
        `)
        .order('created_at', { ascending: false });
      
      if (tableError) throw tableError;

      // For status rejected leads, create one entry per failed distribution
      const statusRejected: any[] = [];
      (rejectedStatusLeads || []).forEach(lead => {
        const failedDistributions = (lead.lead_distributions || []).filter(
          (d: any) => d.status === 'failed'
        );
        
        if (failedDistributions.length > 0) {
          // Create an entry for each failed distribution
          failedDistributions.forEach((dist: any) => {
            statusRejected.push({
              id: `status-${lead.id}-${dist.id}`,
              lead_id: lead.id,
              advertiser_id: dist.advertiser_id,
              reason: dist.response || 'Distribution failed',
              created_at: dist.created_at || lead.created_at,
              leads: {
                firstname: lead.firstname,
                lastname: lead.lastname,
                email: lead.email,
                mobile: lead.mobile,
                country_code: lead.country_code,
                country: lead.country,
                city: lead.city,
                ip_address: lead.ip_address,
                status: lead.status,
                sale_status: lead.sale_status,
                offer_name: lead.offer_name,
                is_ftd: lead.is_ftd,
                injection_ftd: lead.injection_ftd,
                ftd_date: lead.ftd_date,
                ftd_id: lead.ftd_id,
                affiliate_id: lead.affiliate_id,
                advertiser_id: lead.advertiser_id,
                autologin: lead.autologin,
                user_agent: lead.user_agent,
                platform: lead.platform,
                browser: lead.browser,
                comment: lead.comment,
                custom1: lead.custom1,
                custom2: lead.custom2,
                custom3: lead.custom3,
                custom4: lead.custom4,
                custom5: lead.custom5,
                live_lead_status: lead.live_lead_status,
                live_lead_score: lead.live_lead_score,
                request_id: lead.request_id,
                created_at: lead.created_at,
                distributed_at: lead.distributed_at,
                affiliates: lead.affiliates,
              },
              advertisers: dist.advertisers || { name: 'Unknown' },
              source: 'status' as const,
            });
          });
        } else {
          // No distribution records, show generic entry
          statusRejected.push({
            id: `status-${lead.id}`,
            lead_id: lead.id,
            advertiser_id: null,
            reason: 'No advertiser available',
            created_at: lead.created_at,
            leads: {
              firstname: lead.firstname,
              lastname: lead.lastname,
              email: lead.email,
              mobile: lead.mobile,
              country_code: lead.country_code,
              country: lead.country,
              city: lead.city,
              ip_address: lead.ip_address,
              status: lead.status,
              sale_status: lead.sale_status,
              offer_name: lead.offer_name,
              is_ftd: lead.is_ftd,
              injection_ftd: lead.injection_ftd,
              ftd_date: lead.ftd_date,
              ftd_id: lead.ftd_id,
              affiliate_id: lead.affiliate_id,
              advertiser_id: lead.advertiser_id,
              autologin: lead.autologin,
              user_agent: lead.user_agent,
              platform: lead.platform,
              browser: lead.browser,
              comment: lead.comment,
              custom1: lead.custom1,
              custom2: lead.custom2,
              custom3: lead.custom3,
              custom4: lead.custom4,
              custom5: lead.custom5,
              live_lead_status: lead.live_lead_status,
              live_lead_score: lead.live_lead_score,
              request_id: lead.request_id,
              created_at: lead.created_at,
              distributed_at: lead.distributed_at,
              affiliates: lead.affiliates,
            },
            advertisers: { name: 'None Available' },
            source: 'status' as const,
          });
        }
      });

      const tableRejected = (rejectedLeadsTable || []).map(item => ({
        ...item,
        source: 'table' as const,
      }));

      return [...statusRejected, ...tableRejected];
    },
  });
}

export function useDeleteRejectedLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: Array<{ id: string; source: 'status' | 'table'; lead_id?: string }>) => {
      // Separate by source
      const statusItems = items.filter(item => item.source === 'status');
      const tableItems = items.filter(item => item.source === 'table');

      // Delete leads with rejected status (this removes the lead entirely)
      if (statusItems.length > 0) {
        const leadIds = statusItems.map(item => item.lead_id || item.id.replace('status-', ''));
        const { error: leadsError } = await supabase
          .from('leads')
          .delete()
          .in('id', leadIds);
        
        if (leadsError) throw leadsError;
      }

      // Delete from rejected_leads table
      if (tableItems.length > 0) {
        const rejectedLeadIds = tableItems.map(item => item.id);
        const { error: tableError } = await supabase
          .from('rejected_leads')
          .delete()
          .in('id', rejectedLeadIds);
        
        if (tableError) throw tableError;
      }

      return items.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['rejected-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Deleted ${count} rejected lead${count > 1 ? 's' : ''}`);
    },
    onError: (error) => {
      console.error('Error deleting rejected leads:', error);
      toast.error('Failed to delete rejected leads');
    },
  });
}
