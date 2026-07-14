import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string;
  user_email: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changes_summary: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_path: string | null;
  country: string | null;
  city: string | null;
  isp: string | null;
  created_at: string;
}

interface AuditLogsFilters {
  action?: string;
  tableName?: string;
  userEmail?: string;
  userId?: string;
  recordId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLogs(filters: AuditLogsFilters = {}) {
  const { action, tableName, userEmail, userId, recordId, dateFrom, dateTo, page = 1, pageSize = 50 } = filters;

  return useQuery({
    queryKey: ['audit-logs', action, tableName, userEmail, userId, recordId, dateFrom, dateTo, page, pageSize],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('id, action, table_name, record_id, user_id, user_email, old_data, new_data, changes_summary, ip_address, country, city, isp, created_at', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (action) {
        query = query.eq('action', action);
      }
      if (tableName) {
        query = query.eq('table_name', tableName);
      }
      if (userEmail) {
        query = query.ilike('user_email', `%${userEmail}%`);
      }
      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (recordId) {
        query = query.ilike('record_id', `%${recordId}%`);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        logs: data as AuditLog[],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

export function useAuditLogActions() {
  return useQuery({
    queryKey: ['audit-log-actions'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Limit scan — distinct actions rarely exceed a handful of values
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action')
        .order('action')
        .limit(500);

      if (error) throw error;

      return [...new Set(data?.map(d => d.action) || [])];
    },
  });
}

export function useAuditLogTables() {
  return useQuery({
    queryKey: ['audit-log-tables'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Limit scan — distinct table names are a small fixed set
      const { data, error } = await supabase
        .from('audit_logs')
        .select('table_name')
        .not('table_name', 'is', null)
        .order('table_name')
        .limit(500);

      if (error) throw error;

      return [...new Set(data?.map(d => d.table_name).filter(Boolean) || [])] as string[];
    },
  });
}

// Username dropdown options — audit_logs has no username column itself
// (only user_id/user_email), so the filter needs profiles.username separately.
export function useAuditLogUsers() {
  return useQuery({
    queryKey: ['audit-log-users'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .not('username', 'is', null)
        .order('username');

      if (error) throw error;
      return (data || []) as { id: string; username: string }[];
    },
  });
}

export function useAuditLogsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
          queryClient.invalidateQueries({ queryKey: ['audit-log-actions'] });
          queryClient.invalidateQueries({ queryKey: ['audit-log-tables'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
