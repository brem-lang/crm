import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useChatAgent() {
  const { user } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const agentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from("chat_agents")
      .select("id, is_online")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setAgentId(data.id);
          agentIdRef.current = data.id;
          setIsOnline(data.is_online);
        } else {
          const { data: created } = await supabase
            .from("chat_agents")
            .insert({ user_id: user.id })
            .select("id, is_online")
            .single();
          if (created) {
            setAgentId(created.id);
            agentIdRef.current = created.id;
            setIsOnline(created.is_online);
          }
        }
        setLoading(false);
      });

    // Set offline on tab/window close
    const handleUnload = () => {
      if (agentIdRef.current) {
        navigator.sendBeacon(
          "/api/noop", // best-effort only — Supabase call below for normal unmount
          JSON.stringify({ agentId: agentIdRef.current })
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      // Best-effort offline on React unmount
      if (agentIdRef.current) {
        supabase
          .from("chat_agents")
          .update({ is_online: false })
          .eq("id", agentIdRef.current);
      }
    };
  }, [user]);

  async function setOnline(online: boolean) {
    if (!agentId) return;
    setIsOnline(online);
    await supabase
      .from("chat_agents")
      .update({ is_online: online })
      .eq("id", agentId);
  }

  return { agentId, isOnline, setOnline, loading };
}
