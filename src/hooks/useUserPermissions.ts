import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export type UserPermission =
  // Leads
  | 'view_leads'
  | 'view_phone'
  | 'view_email'
  | 'view_all_leads'
  | 'edit_leads'
  | 'delete_leads'
  | 'export_leads'
  | 'resend_leads'
  | 'add_leads_to_test'
  // Advertisers
  | 'view_advertisers'
  | 'create_advertisers'
  | 'edit_advertisers'
  | 'delete_advertisers'
  | 'edit_advertiser_config'
  // Affiliates
  | 'view_affiliates'
  | 'create_affiliates'
  | 'edit_affiliates'
  | 'delete_affiliates'
  | 'manage_affiliate_ip_whitelist'
  | 'view_affiliate_api_logs'
  | 'view_test_logs'
  | 'view_callback_logs'
  // Injection Pools
  | 'create_injection_pools'
  | 'delete_injection_pools'
  // Injection Jobs
  | 'create_injection_jobs'
  | 'delete_injection_jobs'
  // Injection Leads
  | 'export_injection_leads'
  | 'delete_injection_leads'
  // Lead Pools
  | 'create_lead_pools'
  | 'delete_lead_pools'
  // Distributions
  | 'delete_distributions'
  // Distribution Rules
  | 'create_distribution_rules'
  | 'edit_distribution_rules'
  | 'delete_distribution_rules'
  // Conversions
  | 'release_conversions'
  | 'delete_conversions'
  | 'export_conversions'
  // Rejected Leads
  | 'delete_rejected_leads'
  | 'delete_affiliate_submissions'
  // Test Leads
  | 'delete_test_leads'
  // CRM Integration Settings
  | 'view_crm_types'
  | 'create_crm_types'
  | 'edit_crm_types'
  | 'delete_crm_types'
  // Reports & System
  | 'view_reports'
  | 'view_audit_logs'
  | 'view_monitoring'
  // Affiliate Manager visibility
  | 'view_advertiser_name'
  // Advertiser Manager visibility — per-column toggles
  | 'view_lead_name'
  | 'view_lead_id'
  | 'view_lead_country'
  | 'view_lead_ip'
  | 'view_lead_status'
  | 'view_lead_ftd'
  | 'view_lead_affiliate'
  | 'view_lead_offer'
  | 'view_lead_autologin'
  | 'view_lead_device'
  | 'view_lead_comment'
  | 'view_lead_date'
  | 'view_lead_live';

export const AVAILABLE_PERMISSIONS: { id: UserPermission; label: string; description: string; group: string }[] = [
  // Leads
  { group: 'Leads', id: 'view_leads', label: 'View Leads', description: 'Can access the Leads page and view lead records' },
  { group: 'Leads', id: 'view_phone', label: 'View Phone Numbers', description: 'Can see lead phone numbers' },
  { group: 'Leads', id: 'view_email', label: 'View Emails', description: 'Can see lead email addresses' },
  { group: 'Leads', id: 'view_all_leads', label: 'View All Leads', description: 'Can view all leads, not just assigned ones' },
  { group: 'Leads', id: 'edit_leads', label: 'Edit Leads', description: 'Can edit lead information' },
  { group: 'Leads', id: 'delete_leads', label: 'Delete Leads', description: 'Can delete leads' },
  { group: 'Leads', id: 'export_leads', label: 'Export Leads', description: 'Can export leads to CSV' },
  { group: 'Leads', id: 'resend_leads', label: 'Resend Leads', description: 'Can resend leads to advertisers' },
  { group: 'Leads', id: 'add_leads_to_test', label: 'Add Leads to Test', description: 'Can add leads to the test pool' },
  // Advertisers
  { group: 'Advertisers', id: 'view_advertisers', label: 'View Advertisers', description: 'Can access the Advertisers page and view advertiser records' },
  { group: 'Advertisers', id: 'create_advertisers', label: 'Create Advertisers', description: 'Can add new advertisers' },
  { group: 'Advertisers', id: 'edit_advertisers', label: 'Edit Advertisers', description: 'Can edit advertiser details' },
  { group: 'Advertisers', id: 'delete_advertisers', label: 'Delete Advertisers', description: 'Can delete advertisers' },
  { group: 'Advertisers', id: 'edit_advertiser_config', label: 'Edit Advertiser Config', description: 'Can manage advertiser distribution config (pause/activate, cap settings)' },
  // Affiliates
  { group: 'Affiliates', id: 'view_affiliates', label: 'View Affiliates', description: 'Can access the Affiliates page and view affiliate records' },
  { group: 'Affiliates', id: 'create_affiliates', label: 'Create Affiliates', description: 'Can add new affiliates' },
  { group: 'Affiliates', id: 'edit_affiliates', label: 'Edit Affiliates', description: 'Can edit affiliate details' },
  { group: 'Affiliates', id: 'delete_affiliates', label: 'Delete Affiliates', description: 'Can delete affiliates' },
  { group: 'Affiliates', id: 'manage_affiliate_ip_whitelist', label: 'Manage IP Whitelist', description: 'Can enable/disable IP whitelisting and manage allowed IPs per affiliate' },
  { group: 'Affiliates', id: 'view_affiliate_api_logs', label: 'View Affiliate API Logs', description: 'Can access the Affiliate API Logs page' },
  { group: 'Affiliates', id: 'view_test_logs', label: 'View Test Logs', description: 'Can access the Test Lead Logs page' },
  { group: 'Affiliates', id: 'view_callback_logs', label: 'View Callback Logs', description: 'Can access the Callback Logs page' },
  // Injection Pools
  { group: 'Injection', id: 'create_injection_pools', label: 'Create Injection Pools', description: 'Can create injection pools' },
  { group: 'Injection', id: 'delete_injection_pools', label: 'Delete Injection Pools', description: 'Can delete injection pools' },
  // Injection Jobs
  { group: 'Injection', id: 'create_injection_jobs', label: 'Create Injection Jobs', description: 'Can create injection jobs' },
  { group: 'Injection', id: 'delete_injection_jobs', label: 'Delete Injection Jobs', description: 'Can delete injection jobs' },
  // Injection Leads
  { group: 'Injection', id: 'export_injection_leads', label: 'Export Injection Leads', description: 'Can export sent injection leads to CSV' },
  { group: 'Injection', id: 'delete_injection_leads', label: 'Delete Injection Leads', description: 'Can bulk delete sent injection lead records' },
  // Lead Pools
  { group: 'Lead Pools', id: 'create_lead_pools', label: 'Create Lead Pools', description: 'Can create lead pools' },
  { group: 'Lead Pools', id: 'delete_lead_pools', label: 'Delete Lead Pools', description: 'Can delete lead pools and all their leads' },
  // Distributions
  { group: 'Distributions', id: 'delete_distributions', label: 'Delete Distributions', description: 'Can bulk delete distribution records' },
  { group: 'Distributions', id: 'create_distribution_rules', label: 'Create Distribution Rules', description: 'Can create distribution rules' },
  { group: 'Distributions', id: 'edit_distribution_rules', label: 'Edit Distribution Rules', description: 'Can edit distribution rules' },
  { group: 'Distributions', id: 'delete_distribution_rules', label: 'Delete Distribution Rules', description: 'Can delete distribution rules' },
  // Conversions
  { group: 'Conversions', id: 'release_conversions', label: 'Release Conversions', description: 'Can release FTD conversions to affiliates' },
  { group: 'Conversions', id: 'delete_conversions', label: 'Remove FTD Status', description: 'Can bulk remove FTD status from conversions' },
  { group: 'Conversions', id: 'export_conversions', label: 'Export Conversions', description: 'Can export conversion records to CSV' },
  // Rejected / Failed Leads
  { group: 'Rejected Leads', id: 'delete_rejected_leads', label: 'Delete Rejected Leads', description: 'Can bulk delete distribution rejection records' },
  { group: 'Rejected Leads', id: 'delete_affiliate_submissions', label: 'Delete Affiliate Submissions', description: 'Can bulk delete affiliate submission failure records' },
  // Test Leads
  { group: 'Test Leads', id: 'delete_test_leads', label: 'Delete Test Leads', description: 'Can bulk delete test lead log records' },
  // CRM Integration Settings
  { group: 'CRM Settings', id: 'view_crm_types', label: 'View CRM Integrations', description: 'Can access the CRM Integrations settings page' },
  { group: 'CRM Settings', id: 'create_crm_types', label: 'Create CRM Types', description: 'Can create new custom CRM integration types' },
  { group: 'CRM Settings', id: 'edit_crm_types', label: 'Edit CRM Types', description: 'Can edit existing custom CRM integration types' },
  { group: 'CRM Settings', id: 'delete_crm_types', label: 'Delete CRM Types', description: 'Can delete custom CRM integration types' },
  // Reports & System
  { group: 'Reports & System', id: 'view_reports', label: 'View Reports', description: 'Can access the Reports & Analytics page' },
  { group: 'Reports & System', id: 'view_audit_logs', label: 'View Audit Logs', description: 'Can access the Audit Logs page' },
  { group: 'Reports & System', id: 'view_monitoring', label: 'View Monitoring', description: 'Can access the System Monitoring page' },
  // Affiliate Manager
  { group: 'Affiliate Manager', id: 'view_advertiser_name', label: 'View Advertiser Name', description: 'Can see the advertiser name on leads (Affiliate Manager role only)' },
  // Advertiser Manager — column visibility toggles
  { group: 'Advertiser Manager', id: 'view_lead_name',      label: 'View Name',        description: 'Can see first and last name columns' },
  { group: 'Advertiser Manager', id: 'view_lead_id',        label: 'View Lead ID',     description: 'Can see the Lead ID (request_id) column' },
  { group: 'Advertiser Manager', id: 'view_lead_country',   label: 'View Country',     description: 'Can see Country Code, Country, and City columns' },
  { group: 'Advertiser Manager', id: 'view_lead_ip',        label: 'View IP Address',  description: 'Can see the IP Address column' },
  { group: 'Advertiser Manager', id: 'view_lead_status',    label: 'View Status',      description: 'Can see Status and Sale Status columns' },
  { group: 'Advertiser Manager', id: 'view_lead_ftd',       label: 'View FTD',         description: 'Can see FTD, FTD Date, FTD ID, and Injection FTD columns' },
  { group: 'Advertiser Manager', id: 'view_lead_affiliate', label: 'View Affiliate',   description: 'Can see Affiliate and Affiliate ID columns' },
  { group: 'Advertiser Manager', id: 'view_lead_offer',     label: 'View Offer Name',  description: 'Can see the Offer Name column' },
  { group: 'Advertiser Manager', id: 'view_lead_autologin', label: 'View AutoLogin',   description: 'Can see the AutoLogin column' },
  { group: 'Advertiser Manager', id: 'view_lead_device',    label: 'View Device Info', description: 'Can see User Agent, Platform, and Browser columns' },
  { group: 'Advertiser Manager', id: 'view_lead_comment',   label: 'View Comment',     description: 'Can see the Comment column' },
  { group: 'Advertiser Manager', id: 'view_lead_date',      label: 'View Date',        description: 'Can see the Created date column' },
  { group: 'Advertiser Manager', id: 'view_lead_live',      label: 'View Live Lead',   description: 'Can see the Live Lead column' },
];

export function useUserPermissions(userId?: string) {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", userId);
      
      if (error) throw error;
      return (data?.map(p => p.permission) || []) as UserPermission[];
    },
    enabled: !!userId,
  });

  return { permissions: permissions || [], isLoading };
}

export function useAllUsersPermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["all-user-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id, permission");
      
      if (error) throw error;
      
      // Group by user_id
      const grouped: Record<string, UserPermission[]> = {};
      data?.forEach(p => {
        if (!grouped[p.user_id]) grouped[p.user_id] = [];
        grouped[p.user_id].push(p.permission as UserPermission);
      });
      
      return grouped;
    },
  });

  return { permissionsByUser: data || {}, isLoading };
}

export function useCurrentUserPermissions() {
  const { user, isSuperAdmin, roles: userRoles } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["current-user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Load direct user permissions
      const { data: directPerms, error: directError } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", user.id);
      if (directError) throw directError;

      // Load custom role assignments for this user
      const { data: customRoleRows, error: customRolesError } = await supabase
        .from("user_custom_roles")
        .select("role_id, roles(slug)")
        .eq("user_id", user.id);
      if (customRolesError) throw customRolesError;

      // Collect all role slugs (system roles + custom roles)
      const customSlugs = (customRoleRows || [])
        .map((r: any) => r.roles?.slug)
        .filter(Boolean) as string[];
      const allRoleSlugs = [...(userRoles || []), ...customSlugs];

      // Load permissions for each role
      let rolePerms: UserPermission[] = [];
      if (allRoleSlugs.length > 0) {
        const { data: rolePerm, error: rolePermError } = await supabase
          .from("role_permission_mappings")
          .select("permission_key")
          .in("role_slug", allRoleSlugs);
        if (rolePermError) throw rolePermError;
        rolePerms = (rolePerm || []).map(r => r.permission_key) as UserPermission[];
      }

      // Merge: union of role permissions + direct user permissions
      const merged = Array.from(new Set([
        ...rolePerms,
        ...(directPerms?.map(p => p.permission) || []) as UserPermission[],
      ]));
      return merged;
    },
    enabled: !!user?.id,
  });

  // Super admins always have all permissions
  const hasPermission = (permission: UserPermission): boolean => {
    if (isSuperAdmin) return true;
    return permissions?.includes(permission) || false;
  };

  return {
    permissions: permissions || [],
    isLoading,
    hasPermission,
    // Leads
    canViewLeads: hasPermission('view_leads'),
    canViewPhone: hasPermission('view_phone'),
    canViewEmail: hasPermission('view_email'),
    canViewAllLeads: hasPermission('view_all_leads'),
    canEditLeads: hasPermission('edit_leads'),
    canDeleteLeads: hasPermission('delete_leads'),
    canExportLeads: hasPermission('export_leads'),
    canResendLeads: hasPermission('resend_leads'),
    canAddLeadsToTest: hasPermission('add_leads_to_test'),
    // Advertisers
    canViewAdvertisers: hasPermission('view_advertisers'),
    canCreateAdvertisers: hasPermission('create_advertisers'),
    canEditAdvertisers: hasPermission('edit_advertisers'),
    canDeleteAdvertisers: hasPermission('delete_advertisers'),
    canEditAdvertiserConfig: hasPermission('edit_advertiser_config'),
    // Affiliates
    canViewAffiliates: hasPermission('view_affiliates'),
    canCreateAffiliates: hasPermission('create_affiliates'),
    canEditAffiliates: hasPermission('edit_affiliates'),
    canDeleteAffiliates: hasPermission('delete_affiliates'),
    canManageAffiliateIpWhitelist: hasPermission('manage_affiliate_ip_whitelist'),
    canViewAffiliateApiLogs: hasPermission('view_affiliate_api_logs'),
    canViewTestLogs: hasPermission('view_test_logs'),
    canViewCallbackLogs: hasPermission('view_callback_logs'),
    // Injection
    canCreateInjectionPools: hasPermission('create_injection_pools'),
    canDeleteInjectionPools: hasPermission('delete_injection_pools'),
    canCreateInjectionJobs: hasPermission('create_injection_jobs'),
    canDeleteInjectionJobs: hasPermission('delete_injection_jobs'),
    canExportInjectionLeads: hasPermission('export_injection_leads'),
    canDeleteInjectionLeads: hasPermission('delete_injection_leads'),
    // Lead Pools
    canCreateLeadPools: hasPermission('create_lead_pools'),
    canDeleteLeadPools: hasPermission('delete_lead_pools'),
    // Distributions
    canDeleteDistributions: hasPermission('delete_distributions'),
    canCreateDistributionRules: hasPermission('create_distribution_rules'),
    canEditDistributionRules: hasPermission('edit_distribution_rules'),
    canDeleteDistributionRules: hasPermission('delete_distribution_rules'),
    // Conversions
    canReleaseConversions: hasPermission('release_conversions'),
    canDeleteConversions: hasPermission('delete_conversions'),
    canExportConversions: hasPermission('export_conversions'),
    // Rejected / Failed Leads
    canDeleteRejectedLeads: hasPermission('delete_rejected_leads'),
    canDeleteAffiliateSubmissions: hasPermission('delete_affiliate_submissions'),
    // Test Leads
    canDeleteTestLeads: hasPermission('delete_test_leads'),
    // CRM Settings
    canViewCRMTypes: hasPermission('view_crm_types'),
    canCreateCRMTypes: hasPermission('create_crm_types'),
    canEditCRMTypes: hasPermission('edit_crm_types'),
    canDeleteCRMTypes: hasPermission('delete_crm_types'),
    // Reports & System
    canViewReports: hasPermission('view_reports'),
    canViewAuditLogs: hasPermission('view_audit_logs'),
    canViewMonitoring: hasPermission('view_monitoring'),
    // Affiliate Manager
    canViewAdvertiserName: hasPermission('view_advertiser_name'),
    // Advertiser Manager — column visibility
    canViewLeadName:      hasPermission('view_lead_name'),
    canViewLeadId:        hasPermission('view_lead_id'),
    canViewLeadCountry:   hasPermission('view_lead_country'),
    canViewLeadIp:        hasPermission('view_lead_ip'),
    canViewLeadStatus:    hasPermission('view_lead_status'),
    canViewLeadFtd:       hasPermission('view_lead_ftd'),
    canViewLeadAffiliate: hasPermission('view_lead_affiliate'),
    canViewLeadOffer:     hasPermission('view_lead_offer'),
    canViewLeadAutologin: hasPermission('view_lead_autologin'),
    canViewLeadDevice:    hasPermission('view_lead_device'),
    canViewLeadComment:   hasPermission('view_lead_comment'),
    canViewLeadDate:      hasPermission('view_lead_date'),
    canViewLeadLive:      hasPermission('view_lead_live'),
  };
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      permission, 
      action 
    }: { 
      userId: string; 
      permission: UserPermission; 
      action: 'add' | 'remove' 
    }) => {
      if (action === 'add') {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: userId, permission: permission as any });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("permission", permission as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["all-user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] });
      toast.success(`Permission ${variables.action === 'add' ? 'granted' : 'revoked'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update permission");
    },
  });
}
