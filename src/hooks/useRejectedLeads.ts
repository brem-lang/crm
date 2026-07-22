import { useQuery, useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCRMSettings } from "./useCRMSettings";

const LAST_SEEN_KEY = "rejected-leads-last-seen";

// First-ever read seeds "now" instead of epoch, so a fresh browser starts at
// 0 unread instead of counting every rejection that ever happened.
function getLastSeen(): string {
  const stored = localStorage.getItem(LAST_SEEN_KEY);
  if (stored) return stored;
  const now = new Date().toISOString();
  localStorage.setItem(LAST_SEEN_KEY, now);
  return now;
}

export function markRejectedLeadsSeen(queryClient: QueryClient) {
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  queryClient.invalidateQueries({ queryKey: ['rejected-leads-unseen-count'] });
}

// Lightweight count-only query for the sidebar badge — deliberately not
// reusing useRejectedLeads() below, which does expensive joined queries
// fanned out to one row per failed distribution for the full page table.
// This is an approximation (raw row counts, no fan-out) good enough for a
// notification badge.
export function useRejectedLeadsUnseenCount() {
  const { autoRefreshInterval } = useCRMSettings();
  // Default to a 60s poll even with auto-refresh off, since the global
  // QueryClient has refetchOnWindowFocus disabled — otherwise this would
  // only update on remount/navigation.
  const refetchMs = autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : 60_000;

  return useQuery({
    queryKey: ['rejected-leads-unseen-count'],
    refetchInterval: refetchMs,
    queryFn: async () => {
      const lastSeen = getLastSeen();
      const [statusRes, tableRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'rejected')
          .gt('created_at', lastSeen),
        supabase
          .from('rejected_leads')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastSeen),
      ]);
      return (statusRes.count || 0) + (tableRes.count || 0);
    },
  });
}

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
          click_ip,
          click_country,
          click_asn,
          submission_country,
          submission_asn,
          click_ua,
          time_to_click,
          is_proxy,
          locale,
          click_id,
          submission_ua,
          created_at,
          distributed_at,
          affiliates(name),
          lead_distributions(
            id,
            advertiser_id,
            status,
            request_url,
            request_headers,
            request_payload,
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
            click_ip, click_country, click_asn, submission_country, submission_asn,
            click_ua, time_to_click, is_proxy, locale, click_id, submission_ua,
            request_id, created_at, distributed_at, affiliates(name),
            lead_distributions(
              id,
              advertiser_id,
              status,
              request_url,
              request_headers,
              request_payload,
              response,
              created_at
            )
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
                click_ip: lead.click_ip,
                click_country: lead.click_country,
                click_asn: lead.click_asn,
                submission_country: lead.submission_country,
                submission_asn: lead.submission_asn,
                click_ua: lead.click_ua,
                time_to_click: lead.time_to_click,
                is_proxy: lead.is_proxy,
                locale: lead.locale,
                click_id: lead.click_id,
                submission_ua: lead.submission_ua,
                request_id: lead.request_id,
                created_at: lead.created_at,
                distributed_at: lead.distributed_at,
                affiliates: lead.affiliates,
              },
              advertisers: dist.advertisers || { name: 'Unknown' },
              distribution: dist,
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
              click_ip: lead.click_ip,
              click_country: lead.click_country,
              click_asn: lead.click_asn,
              submission_country: lead.submission_country,
              submission_asn: lead.submission_asn,
              click_ua: lead.click_ua,
              time_to_click: lead.time_to_click,
              is_proxy: lead.is_proxy,
              locale: lead.locale,
              click_id: lead.click_id,
              submission_ua: lead.submission_ua,
              request_id: lead.request_id,
              created_at: lead.created_at,
              distributed_at: lead.distributed_at,
              affiliates: lead.affiliates,
            },
            advertisers: { name: 'None Available' },
            distribution: null,
            source: 'status' as const,
          });
        }
      });

      const tableRejected = (rejectedLeadsTable || []).map((item: any) => ({
        ...item,
        distribution: item.leads?.lead_distributions?.find(
          (d: any) => d.advertiser_id === item.advertiser_id
        ) ?? null,
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

      // Soft-delete leads with rejected status
      if (statusItems.length > 0) {
        const leadIds = statusItems.map(item => item.lead_id || item.id.replace('status-', ''));
        const { error: leadsError } = await supabase.rpc('soft_delete_leads', { _ids: leadIds });

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
