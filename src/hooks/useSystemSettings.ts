import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SystemSettings {
  id: number;
  // General
  crm_name: string;
  timezone: string;
  date_format: string;
  default_page_size: number;
  show_lead_id: boolean;
  compact_mode: boolean;
  auto_refresh_interval: number;
  // Lead Management
  duplicate_detection_enabled: boolean;
  duplicate_window_days: number;
  duplicate_match_field: string;
  // Distribution
  distribution_enabled: boolean;
  default_daily_cap: number;
  // Affiliates
  affiliate_self_registration: boolean;
  affiliate_default_status: string;
  // Users & Security
  user_self_registration: boolean;
  max_login_attempts: number;
  session_timeout_minutes: number;
  // System
  maintenance_mode: boolean;
  maintenance_message: string;
  audit_log_retention_days: number;
  // Restricted Countries
  restricted_countries: string[];
  // Leads page column order (super_admin-managed, shared with all roles)
  leads_column_order: string[];
  updated_at: string;
  updated_by: string | null;
}

export const SYSTEM_SETTINGS_DEFAULTS: Omit<SystemSettings, "id" | "updated_at" | "updated_by"> = {
  crm_name: "CRM",
  timezone: "UTC",
  date_format: "yyyy-MM-dd HH:mm:ss",
  default_page_size: 25,
  show_lead_id: true,
  compact_mode: false,
  auto_refresh_interval: 0,
  duplicate_detection_enabled: false,
  duplicate_window_days: 30,
  duplicate_match_field: "email",
  distribution_enabled: true,
  default_daily_cap: 0,
  affiliate_self_registration: false,
  affiliate_default_status: "active",
  user_self_registration: false,
  max_login_attempts: 0,
  session_timeout_minutes: 0,
  maintenance_mode: false,
  maintenance_message: "System is under maintenance. Please check back later.",
  audit_log_retention_days: 0,
  restricted_countries: [],
  leads_column_order: [],
};

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;

      return (data ?? { id: 1, updated_at: new Date().toISOString(), updated_by: null, ...SYSTEM_SETTINGS_DEFAULTS }) as SystemSettings;
    },
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<SystemSettings, "id" | "updated_at" | "updated_by">>) => {
      const { data, error } = await supabase
        .from("crm_settings")
        .update({ ...updates, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
        .eq("id", 1)
        .select()
        .single();

      if (error) throw error;
      return data as SystemSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["system-settings"], data);
      toast.success("Settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
