import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RuleType = "priority" | "weighted" | "affiliate" | "geo";

export interface RuleConditions {
  affiliate_ids?: string[];
  country_codes?: string[];
  language_codes?: string[];
  device_types?: string[];
}

export interface RuleTarget {
  id?: string;
  advertiser_id: string;
  weight: number;
  priority_order: number;
  is_fallback: boolean;
  is_enabled: boolean;
  daily_cap?: number | null;
}

export interface DistributionRule {
  id: string;
  name: string;
  rule_type: RuleType;
  is_active: boolean;
  priority: number;
  conditions: RuleConditions;
  created_at: string;
  updated_at: string;
  targets?: (RuleTarget & { advertiser_name?: string })[];
}

const QUERY_KEY = ["distribution-rules"] as const;

export function useDistributionRules() {
  return useQuery({
    queryKey: QUERY_KEY,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data: rules, error } = await supabase
        .from("distribution_rules")
        .select("id, name, rule_type, is_active, priority, conditions, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: targets, error: targetsError } = await supabase
        .from("distribution_rule_targets")
        .select(`
          id, rule_id, advertiser_id, weight, priority_order, is_fallback, is_enabled, daily_cap,
          advertisers(id, name)
        `);

      if (targetsError) throw targetsError;

      const targetMap: Record<string, (RuleTarget & { advertiser_name?: string })[]> = {};
      for (const t of targets || []) {
        if (!targetMap[t.rule_id]) targetMap[t.rule_id] = [];
        targetMap[t.rule_id].push({
          id: t.id,
          advertiser_id: t.advertiser_id,
          weight: t.weight,
          priority_order: t.priority_order,
          is_fallback: t.is_fallback,
          is_enabled: t.is_enabled ?? true,
          daily_cap: t.daily_cap ?? null,
          advertiser_name: (t as any).advertisers?.name,
        });
      }

      return (rules || []).map((r) => ({
        ...r,
        conditions: (r.conditions as RuleConditions) ?? {},
        targets: (targetMap[r.id] || []).sort((a, b) => a.priority_order - b.priority_order),
      })) as DistributionRule[];
    },
  });
}

export function useCreateDistributionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rule,
      targets,
    }: {
      rule: { name: string; rule_type: RuleType; priority: number; conditions: RuleConditions };
      targets: RuleTarget[];
    }) => {
      const { data: created, error } = await supabase
        .from("distribution_rules")
        .insert({
          name: rule.name,
          rule_type: rule.rule_type,
          priority: rule.priority,
          conditions: rule.conditions as any,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (targets.length > 0) {
        const { error: targetsError } = await supabase
          .from("distribution_rule_targets")
          .insert(
            targets.map((t) => ({
              rule_id: created.id,
              advertiser_id: t.advertiser_id,
              weight: t.weight,
              priority_order: t.priority_order,
              is_fallback: t.is_fallback,
              is_enabled: t.is_enabled ?? true,
              daily_cap: t.daily_cap ?? null,
            }))
          );
        if (targetsError) throw targetsError;
      }

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Distribution rule created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateDistributionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      rule,
      targets,
    }: {
      id: string;
      rule: Partial<{ name: string; rule_type: RuleType; priority: number; conditions: RuleConditions; is_active: boolean }>;
      targets?: RuleTarget[];
    }) => {
      const updatePayload: Record<string, unknown> = {};
      if (rule.name !== undefined) updatePayload.name = rule.name;
      if (rule.rule_type !== undefined) updatePayload.rule_type = rule.rule_type;
      if (rule.priority !== undefined) updatePayload.priority = rule.priority;
      if (rule.conditions !== undefined) updatePayload.conditions = rule.conditions as any;
      if (rule.is_active !== undefined) updatePayload.is_active = rule.is_active;

      const { error } = await supabase
        .from("distribution_rules")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      if (targets !== undefined) {
        await supabase.from("distribution_rule_targets").delete().eq("rule_id", id);

        if (targets.length > 0) {
          const { error: targetsError } = await supabase
            .from("distribution_rule_targets")
            .insert(
              targets.map((t) => ({
                rule_id: id,
                advertiser_id: t.advertiser_id,
                weight: t.weight,
                priority_order: t.priority_order,
                is_fallback: t.is_fallback,
                is_enabled: t.is_enabled ?? true,
                daily_cap: t.daily_cap ?? null,
              }))
            );
          if (targetsError) throw targetsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Distribution rule updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteDistributionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("distribution_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Rule deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useToggleDistributionRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // Step 1: Toggle the rule itself
      const { error } = await supabase
        .from("distribution_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;

      // Step 2: Get all advertiser IDs targeted by this rule
      const { data: targets, error: targetsError } = await supabase
        .from("distribution_rule_targets")
        .select("advertiser_id")
        .eq("rule_id", id);
      if (targetsError) throw targetsError;

      const advertiserIds = [...new Set((targets || []).map((t) => t.advertiser_id))];
      if (advertiserIds.length === 0) return;

      if (!is_active) {
        // Deactivating — pause all targeted advertisers immediately (strict: any inactive rule = paused)
        const { error: settingsError } = await supabase
          .from("advertiser_distribution_settings")
          .update({ is_active: false })
          .in("advertiser_id", advertiserIds);
        if (settingsError) throw settingsError;
        return;
      }

      // Activating — re-activate only advertisers where ALL sibling rules are also active
      const { data: siblingTargets, error: siblingError } = await supabase
        .from("distribution_rule_targets")
        .select("advertiser_id, rule_id, distribution_rules(is_active)")
        .in("advertiser_id", advertiserIds)
        .neq("rule_id", id);
      if (siblingError) throw siblingError;

      // Collect advertisers that still have at least one inactive sibling rule
      const blockedByInactiveRule = new Set<string>();
      for (const t of siblingTargets || []) {
        if ((t as any).distribution_rules?.is_active === false) {
          blockedByInactiveRule.add(t.advertiser_id);
        }
      }

      // Only re-activate advertisers with no remaining inactive rules
      const toActivate = advertiserIds.filter((aid) => !blockedByInactiveRule.has(aid));
      if (toActivate.length > 0) {
        const { error: settingsError } = await supabase
          .from("advertiser_distribution_settings")
          .update({ is_active: true })
          .in("advertiser_id", toActivate);
        if (settingsError) throw settingsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["distribution-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useReorderDistributionRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; priority: number }[]) => {
      await Promise.all(
        updates.map(({ id, priority }) =>
          supabase.from("distribution_rules").update({ priority }).eq("id", id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Rule order saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
