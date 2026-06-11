import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UserPermission } from "./useUserPermissions";

export function useRolePermissions(roleSlug?: string) {
  return useQuery({
    queryKey: ["role-permission-mappings", roleSlug],
    queryFn: async () => {
      if (!roleSlug) return [];
      const { data, error } = await supabase
        .from("role_permission_mappings")
        .select("permission_key")
        .eq("role_slug", roleSlug);
      if (error) throw error;
      return (data || []).map(r => r.permission_key) as UserPermission[];
    },
    enabled: !!roleSlug,
  });
}

export function useAllRolePermissions() {
  return useQuery({
    queryKey: ["all-role-permission-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permission_mappings")
        .select("role_slug, permission_key");
      if (error) throw error;
      const grouped: Record<string, UserPermission[]> = {};
      data?.forEach(r => {
        if (!grouped[r.role_slug]) grouped[r.role_slug] = [];
        grouped[r.role_slug].push(r.permission_key as UserPermission);
      });
      return grouped;
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleSlug, permissions }: { roleSlug: string; permissions: UserPermission[] }) => {
      // Delete all existing mappings for this role
      const { error: deleteError } = await supabase
        .from("role_permission_mappings")
        .delete()
        .eq("role_slug", roleSlug);
      if (deleteError) throw deleteError;

      // Insert the new set
      if (permissions.length > 0) {
        const { error: insertError } = await supabase
          .from("role_permission_mappings")
          .insert(permissions.map(p => ({ role_slug: roleSlug, permission_key: p })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { roleSlug }) => {
      queryClient.invalidateQueries({ queryKey: ["role-permission-mappings", roleSlug] });
      queryClient.invalidateQueries({ queryKey: ["all-role-permission-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] });
      toast.success("Permissions saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save permissions"),
  });
}
