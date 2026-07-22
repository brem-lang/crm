import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { useEffect } from "react";
import { useCRMSettings } from "./useCRMSettings";

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

// Separate hook for realtime subscription - call this at page level
export function useLeadsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          console.log('Lead realtime update:', payload);
          // Only refetch queries actively mounted — avoids triggering stale
          // background cache entries on every realtime event
          queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useLeads(options?: {
  // Restrict to leads from specific affiliate IDs (affiliate manager).
  filterAffiliateIds?: string[];
  // Restrict to leads distributed to specific advertiser IDs (advertiser manager).
  filterAdvertiserIds?: string[];
  enabled?: boolean;
}) {
  const { autoRefreshInterval } = useCRMSettings();
  const refetchMs = autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : false;

  return useQuery({
    queryKey: ['leads', options?.filterAffiliateIds, options?.filterAdvertiserIds],
    staleTime: 30 * 1000,
    enabled: options?.enabled !== false,
    queryFn: async () => {
      // No assignments at all → no leads
      if (
        (options?.filterAffiliateIds !== undefined && options.filterAffiliateIds.length === 0) ||
        (options?.filterAdvertiserIds !== undefined && options.filterAdvertiserIds.length === 0)
      ) {
        return [];
      }

      let query = supabase
        .from('leads')
        .select(`
          *,
          affiliates(name),
          lead_distributions(
            advertiser_id,
            status,
            external_lead_id,
            autologin_url,
            request_url,
            request_headers,
            request_payload,
            response,
            advertisers(name)
          )
        `)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (options?.filterAffiliateIds !== undefined && options.filterAffiliateIds.length > 0) {
        query = query.in('affiliate_id', options.filterAffiliateIds);
      }

      // For advertiser filter: resolve lead IDs via lead_distributions first
      if (options?.filterAdvertiserIds !== undefined && options.filterAdvertiserIds.length > 0) {
        const { data: dists, error: distsError } = await supabase
          .from('lead_distributions')
          .select('lead_id')
          .in('advertiser_id', options.filterAdvertiserIds);
        if (distsError) throw distsError;
        const leadIds = [...new Set((dists || []).map(d => d.lead_id))];
        if (leadIds.length === 0) return [];
        query = query.in('id', leadIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: refetchMs,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          affiliates(name),
          lead_distributions(*, advertisers(name))
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.id] });
      toast.success('Lead updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useBulkDeleteLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${ids.length} leads deleted successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useBulkAddToTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      // Fetch the leads first
      const { data: leads, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .in('id', ids);

      if (fetchError) throw fetchError;
      if (!leads || leads.length === 0) return;

      // Insert each lead into test_lead_logs as test_data
      const logs = leads.map((lead) => ({
        advertiser_id: null,
        test_data: lead as any,
        success: true,
        response: 'Moved from leads table',
      }));

      const { error: insertError } = await supabase
        .from('test_lead_logs')
        .insert(logs as any);

      if (insertError) throw insertError;

      // Delete from leads table
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['test-lead-logs'] });
      toast.success(`${ids.length} lead${ids.length !== 1 ? 's' : ''} moved to test logs`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}