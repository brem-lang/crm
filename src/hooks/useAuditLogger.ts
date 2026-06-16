import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface AuditDetails {
  table_name?: string;
  record_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  changes_summary?: string;
}

export function useAuditLogger() {
  const { user } = useAuth();

  return useCallback(async (action: string, details?: AuditDetails) => {
    if (!user) return;
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        action,
        request_path: window.location.pathname,
        ...details,
      });
    } catch (err) {
      console.error("[AuditLogger] Failed:", err);
    }
  }, [user]);
}
