import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

// Fetch advertiser assignments for a specific user (super admin use)
export function useUserAdvertiserAssignments(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-advertiser-assignments", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_advertiser_assignments")
        .select("advertiser_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map(r => r.advertiser_id);
    },
    enabled: !!userId,
  });
}

// Returns null if not an advertiser manager (no restriction),
// or string[] (possibly empty) of advertiser IDs the current user is allowed to see.
// Returns undefined while still loading.
export function useMyAdvertiserRestriction() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-advertiser-restriction", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: customRoles, error: rolesError } = await supabase
        .from("user_custom_roles")
        .select("roles(slug)")
        .eq("user_id", user.id);
      if (rolesError) throw rolesError;

      const isAdvertiserManager = (customRoles || []).some(
        (r: any) => r.roles?.slug === "advertiser_manager"
      );

      if (!isAdvertiserManager) return null;

      const { data: assignments, error: assignmentsError } = await supabase
        .from("user_advertiser_assignments")
        .select("advertiser_id")
        .eq("user_id", user.id);
      if (assignmentsError) throw assignmentsError;

      return (assignments || []).map(r => r.advertiser_id);
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}

// Mutation: replace all advertiser assignments for a user (super admin only)
export function useSetUserAdvertiserAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      advertiserIds,
    }: {
      userId: string;
      advertiserIds: string[];
    }) => {
      const { error: deleteError } = await supabase
        .from("user_advertiser_assignments")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;

      if (advertiserIds.length > 0) {
        const rows = advertiserIds.map(advertiser_id => ({ user_id: userId, advertiser_id }));
        const { error: insertError } = await supabase
          .from("user_advertiser_assignments")
          .insert(rows as any);
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-advertiser-assignments", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-advertiser-restriction"] });
      toast.success("Advertiser assignments updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update advertiser assignments");
    },
  });
}
