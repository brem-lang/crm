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
        let id: string | null = null;

        if (data) {
          id = data.id;
          // Always start offline on mount — prevents stale is_online=true rows
          // from routing visitors to an absent agent after a browser crash/close.
          if (data.is_online) {
            await supabase
              .from("chat_agents")
              .update({ is_online: false })
              .eq("id", id);
          }
        } else {
          const { data: created } = await supabase
            .from("chat_agents")
            .insert({ user_id: user.id, is_online: false })
            .select("id")
            .single();
          if (created) id = created.id;
        }

        if (id) {
          setAgentId(id);
          agentIdRef.current = id;
        }
        setIsOnline(false);
        setLoading(false);
      });

    // Best-effort offline on tab/window close via keepalive fetch
    const handleUnload = () => {
      const id = agentIdRef.current;
      if (!id) return;
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return;
      const token = supabase.auth.getSession().then(({ data }) => {
        const accessToken = data.session?.access_token ?? key;
        fetch(`${url}/rest/v1/chat_agents?id=eq.${id}`, {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": `Bearer ${accessToken}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ is_online: false }),
        }).catch(() => {/* best-effort */});
      });
      void token;
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
