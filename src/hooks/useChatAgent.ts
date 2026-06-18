import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SESSION_ALIVE_KEY = "chat_agent_session_alive";

export function useChatAgent() {
  const { user } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const agentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // sessionStorage survives page refreshes but is cleared when the tab is closed.
    // If the flag exists → this is a refresh (agent intentionally went online) → keep DB status.
    // If the flag is absent → fresh tab/browser open → reset to offline to avoid stale state.
    const isPageRefresh = sessionStorage.getItem(SESSION_ALIVE_KEY) === "true";

    supabase
      .from("chat_agents")
      .select("id, is_online")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        let id: string | null = null;
        let online = false;

        if (data) {
          id = data.id;
          if (isPageRefresh) {
            // Keep whatever status the agent had — they refreshed the page
            online = data.is_online;
          } else {
            // Fresh tab/window: reset stale online status so visitors aren't
            // routed to an absent agent after a browser crash or close.
            if (data.is_online) {
              await supabase
                .from("chat_agents")
                .update({ is_online: false })
                .eq("id", id);
            }
            online = false;
          }
        } else {
          const { data: created } = await supabase
            .from("chat_agents")
            .insert({ user_id: user.id, is_online: false })
            .select("id")
            .single();
          if (created) id = created.id;
          online = false;
        }

        if (id) {
          setAgentId(id);
          agentIdRef.current = id;
        }
        setIsOnline(online);
        setLoading(false);

        // Mark this tab as active so the next mount (page refresh) preserves status
        sessionStorage.setItem(SESSION_ALIVE_KEY, "true");
      });

    // Best-effort offline on tab/window close via keepalive fetch
    const handleUnload = () => {
      // Clear the session flag so the next open starts offline
      sessionStorage.removeItem(SESSION_ALIVE_KEY);

      const id = agentIdRef.current;
      if (!id) return;
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return;
      supabase.auth.getSession().then(({ data }) => {
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
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      // Best-effort offline on React unmount (e.g. navigating away)
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
