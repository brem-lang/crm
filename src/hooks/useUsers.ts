import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserWithRoles {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  created_at: string;
  is_active: boolean;
  roles: string[];
  customRoles: { name: string; color: string; slug: string }[];
}

export function useUsers() {
  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [profilesRes, systemRolesRes, customRolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, username, created_at, is_active")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("user_custom_roles")
          .select("user_id, roles(name, color, slug)"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (systemRolesRes.error) throw systemRolesRes.error;

      const usersWithRoles: UserWithRoles[] = (profilesRes.data || []).map((profile) => {
        const systemRoles = (systemRolesRes.data || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role);

        const customRoles = ((customRolesRes.data || []) as any[])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.roles)
          .filter(Boolean);

        return { ...profile, is_active: profile.is_active ?? true, roles: systemRoles, customRoles };
      });

      return usersWithRoles;
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role, action }: { userId: string; role: string; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: role as any });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success(`Role ${variables.action === 'add' ? 'added' : 'removed'} successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const updateUsername = useMutation({
    mutationFn: async ({ userId, username }: { userId: string; username: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ username })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Username updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update username");
    },
  });

  const toggleUserActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.rpc("set_user_active", {
        _target_user_id: userId,
        _active: active,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success(`User ${variables.active ? "activated" : "deactivated"} successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user status");
    },
  });

  return {
    users,
    isLoading,
    error,
    updateUserRole,
    updateUsername,
    toggleUserActive,
  };
}
