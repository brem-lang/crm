import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgentSession {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: string;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAgentSessions(agentId: string | null, activeSessionId: string | null) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  // unread = count of non-agent messages received while session wasn't active
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  // last message preview per session
  const [lastMsgMap, setLastMsgMap] = useState<Record<string, string>>({});

  // Keep activeSessionId in a ref so realtime callbacks always see the latest value
  const activeRef = useRef<string | null>(activeSessionId);
  useEffect(() => { activeRef.current = activeSessionId; }, [activeSessionId]);

  useEffect(() => {
    if (!agentId) return;

    setLoading(true);

    // Initial load
    supabase
      .from("chat_sessions")
      .select("id, visitor_name, visitor_email, status, agent_id, created_at, updated_at")
      .in("status", ["waiting", "active"])
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        setSessions((data as AgentSession[]) ?? []);
        setLoading(false);
      });

    // Realtime — session changes
    const sessionCh = supabase
      .channel("agent:sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions" },
        payload => {
          if (payload.eventType === "INSERT") {
            const s = payload.new as AgentSession;
            if (["waiting", "active"].includes(s.status)) {
              setSessions(prev =>
                prev.some(x => x.id === s.id) ? prev : [s, ...prev]
              );
            }
          } else if (payload.eventType === "UPDATE") {
            const s = payload.new as AgentSession;
            setSessions(prev => {
              if (!["waiting", "active"].includes(s.status)) {
                return prev.filter(x => x.id !== s.id);
              }
              const idx = prev.findIndex(x => x.id === s.id);
              if (idx < 0) return [s, ...prev];
              const next = [...prev];
              next[idx] = s;
              return next;
            });
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setSessions(prev => prev.filter(x => x.id !== old.id));
          }
        }
      )
      .subscribe();

    // Realtime — message inserts across all sessions (unread + preview)
    const msgCh = supabase
      .channel("agent:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        payload => {
          const msg = payload.new as {
            session_id: string;
            sender_type: string;
            content: string;
          };
          // Update last-message preview for sidebar
          if (msg.sender_type !== "agent") {
            setLastMsgMap(prev => ({ ...prev, [msg.session_id]: msg.content }));
          }
          // Increment unread if this session isn't the one currently open
          if (
            msg.sender_type !== "agent" &&
            msg.session_id !== activeRef.current
          ) {
            setUnreadMap(prev => ({
              ...prev,
              [msg.session_id]: (prev[msg.session_id] ?? 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionCh);
      supabase.removeChannel(msgCh);
    };
  }, [agentId]);

  function markViewed(sessionId: string) {
    setUnreadMap(prev => ({ ...prev, [sessionId]: 0 }));
  }

  async function acceptChat(sessionId: string, agentUserId: string) {
    const { error } = await supabase.rpc("accept_chat", {
      _session_id: sessionId,
      _agent_user_id: agentUserId,
    });
    if (error) {
      toast.error("Could not accept chat: " + error.message);
      throw error;
    }
  }

  async function closeChat(sessionId: string) {
    const { error } = await supabase.rpc("close_chat", {
      _session_id: sessionId,
    });
    if (error) {
      toast.error("Could not close chat: " + error.message);
      throw error;
    }
  }

  return {
    sessions,
    loading,
    unreadMap,
    lastMsgMap,
    markViewed,
    acceptChat,
    closeChat,
  };
}
