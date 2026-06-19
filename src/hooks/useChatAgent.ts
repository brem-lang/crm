import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useChatAgent() {
  const { user } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const agentIdRef = useRef<string | null>(null);
  // Cache access token synchronously so beforeunload handler doesn't need async
  const accessTokenRef = useRef<string | null>(null);

  // Keep access token ref fresh whenever the auth session changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from("chat_agents")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        let id: string | null = null;

        if (data) {
          id = data.id;
          await supabase.from("chat_agents").update({ is_online: true }).eq("id", id);
        } else {
          const { data: created } = await supabase
            .from("chat_agents")
            .insert({ user_id: user.id, is_online: true })
            .select("id")
            .single();
          if (created) id = created.id;
        }

        if (id) {
          setAgentId(id);
          agentIdRef.current = id;
        }
        setIsOnline(true);
        setLoading(false);
      });

    const handleUnload = () => {
      const id = agentIdRef.current;
      if (!id) return;
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return;
      const token = accessTokenRef.current ?? key;
      fetch(`${url}/rest/v1/chat_agents?id=eq.${id}`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "apikey": key,
          "Authorization": `Bearer ${token}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ is_online: false }),
      }).catch(() => { /* best-effort */ });
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (agentIdRef.current) {
        supabase.from("chat_agents").update({ is_online: false }).eq("id", agentIdRef.current);
      }
    };
  }, [user]);

  return { agentId, isOnline, loading };
}
