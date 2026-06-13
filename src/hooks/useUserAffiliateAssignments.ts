import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

// Fetch affiliate assignments for a specific user (super admin use)
export function useUserAffiliateAssignments(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-affiliate-assignments", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_affiliate_assignments")
        .select("affiliate_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map(r => r.affiliate_id);
    },
    enabled: !!userId,
  });
}

// Returns null if not an affiliate manager (no restriction),
// or string[] (possibly empty) of affiliate IDs the current user is allowed to see.
// Returns undefined while still loading.
export function useMyAffiliateRestriction() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-affiliate-restriction", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Check if current user has the affiliate_manager custom role
      const { data: customRoles, error: rolesError } = await supabase
        .from("user_custom_roles")
        .select("roles(slug)")
        .eq("user_id", user.id);
      if (rolesError) throw rolesError;

      const isAffiliateManager = (customRoles || []).some(
        (r: any) => r.roles?.slug === "affiliate_manager"
      );

      if (!isAffiliateManager) return null;

      // Fetch assigned affiliate IDs
      const { data: assignments, error: assignmentsError } = await supabase
        .from("user_affiliate_assignments")
        .select("affiliate_id")
        .eq("user_id", user.id);
      if (assignmentsError) throw assignmentsError;

      return (assignments || []).map(r => r.affiliate_id);
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}

// Mutation: replace all affiliate assignments for a user (super admin only)
export function useSetUserAffiliateAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      affiliateIds,
    }: {
      userId: string;
      affiliateIds: string[];
    }) => {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from("user_affiliate_assignments")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Insert new assignments
      if (affiliateIds.length > 0) {
        const rows = affiliateIds.map(affiliate_id => ({ user_id: userId, affiliate_id }));
        const { error: insertError } = await supabase
          .from("user_affiliate_assignments")
          .insert(rows as any);
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-affiliate-assignments", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-affiliate-restriction"] });
      toast.success("Affiliate assignments updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update affiliate assignments");
    },
  });
}
