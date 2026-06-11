import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_system: boolean;
  created_at: string;
  user_count?: number;
}

export const ROLE_COLORS: { value: string; label: string; bg: string; text: string; border: string }[] = [
  { value: "red",    label: "Red",    bg: "bg-red-500/10",    text: "text-red-500",    border: "border-red-500/30" },
  { value: "blue",   label: "Blue",   bg: "bg-blue-500/10",   text: "text-blue-500",   border: "border-blue-500/30" },
  { value: "green",  label: "Green",  bg: "bg-green-500/10",  text: "text-green-500",  border: "border-green-500/30" },
  { value: "purple", label: "Purple", bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/30" },
  { value: "orange", label: "Orange", bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  { value: "cyan",   label: "Cyan",   bg: "bg-cyan-500/10",   text: "text-cyan-500",   border: "border-cyan-500/30" },
  { value: "gray",   label: "Gray",   bg: "bg-gray-500/10",   text: "text-gray-500",   border: "border-gray-500/30" },
];

export function getRoleColor(color: string) {
  return ROLE_COLORS.find(c => c.value === color) ?? ROLE_COLORS[ROLE_COLORS.length - 1];
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("created_at", { ascending: true });

      if (rolesError) throw rolesError;

      // Fetch user counts from user_roles (system roles)
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("role");

      // Fetch custom role user counts
      const { data: customRolesData } = await supabase
        .from("user_custom_roles")
        .select("role_id");

      const systemRoleCounts: Record<string, number> = {};
      userRolesData?.forEach(r => {
        systemRoleCounts[r.role] = (systemRoleCounts[r.role] || 0) + 1;
      });

      const customRoleCounts: Record<string, number> = {};
      customRolesData?.forEach(r => {
        customRoleCounts[r.role_id] = (customRoleCounts[r.role_id] || 0) + 1;
      });

      return (rolesData || []).map(role => ({
        ...role,
        user_count: role.is_system
          ? (systemRoleCounts[role.slug] || 0)
          : (customRoleCounts[role.id] || 0),
      })) as Role[];
    },
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; slug: string; description: string; color: string }) => {
      const { error } = await supabase.from("roles").insert({
        name: payload.name,
        slug: payload.slug,
        description: payload.description || null,
        color: payload.color,
        is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role created");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create role"),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permission-mappings"] });
      toast.success("Role deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete role"),
  });
}

export function useUserCustomRoles(userId?: string) {
  return useQuery({
    queryKey: ["user-custom-roles", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_custom_roles")
        .select("role_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map(r => r.role_id);
    },
    enabled: !!userId,
  });
}

export function useSyncUserCustomRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => {
      // Delete all existing custom roles for user
      const { error: deleteError } = await supabase
        .from("user_custom_roles")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Insert new ones
      if (roleIds.length > 0) {
        const { error: insertError } = await supabase
          .from("user_custom_roles")
          .insert(roleIds.map(role_id => ({ user_id: userId, role_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-custom-roles", userId] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update custom roles"),
  });
}
