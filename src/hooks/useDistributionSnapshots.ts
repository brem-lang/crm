import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STORAGE_KEY = "dist_snapshots_v1";
const MAX_SNAPSHOTS = 20;

export interface DistributionSnapshot {
  id: string;
  created_at: string;
  label: string;
  settings: Record<string, unknown>[];
}

function loadSnapshots(): DistributionSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSnapshots(snaps: DistributionSnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snaps.slice(0, MAX_SNAPSHOTS)));
}

export function useDistributionSnapshots() {
  const [snapshots, setSnapshots] = useState<DistributionSnapshot[]>(loadSnapshots);
  const queryClient = useQueryClient();

  const createSnapshot = useCallback(
    async (label?: string) => {
      const { data, error } = await supabase
        .from("advertiser_distribution_settings")
        .select("*");
      if (error) { toast.error("Failed to create snapshot"); return; }

      const snap: DistributionSnapshot = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        label: label || `Snapshot ${new Date().toLocaleString()}`,
        settings: data as Record<string, unknown>[],
      };

      setSnapshots(prev => {
        const next = [snap, ...prev];
        saveSnapshots(next);
        return next;
      });
      toast.success("Snapshot saved");
    },
    []
  );

  const restoreSnapshot = useCallback(
    async (snap: DistributionSnapshot) => {
      if (!confirm(`Restore snapshot "${snap.label}"? This will overwrite all current distribution settings.`))
        return;

      try {
        for (const setting of snap.settings) {
          const { error } = await supabase
            .from("advertiser_distribution_settings")
            .upsert(setting as any, { onConflict: "id" });
          if (error) throw error;
        }
        queryClient.invalidateQueries({ queryKey: ["distribution-settings"] });
        queryClient.invalidateQueries({ queryKey: ["today-distribution-counts"] });
        queryClient.invalidateQueries({ queryKey: ["recent-distribution-stats"] });
        queryClient.invalidateQueries({ queryKey: ["live-telemetry"] });
        toast.success("Snapshot restored");
      } catch {
        toast.error("Failed to restore snapshot");
      }
    },
    [queryClient]
  );

  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => {
      const next = prev.filter(s => s.id !== id);
      saveSnapshots(next);
      return next;
    });
  }, []);

  return { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot };
}
