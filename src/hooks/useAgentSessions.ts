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

const POLL_INTERVAL = 3000;

export function useAgentSessions(agentId: string | null, activeSessionId: string | null) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [lastMsgMap, setLastMsgMap] = useState<Record<string, string>>({});

  const activeRef = useRef<string | null>(activeSessionId);
  useEffect(() => { activeRef.current = activeSessionId; }, [activeSessionId]);

  // Track whether realtime is working — polling only runs as fallback
  const realtimeOkRef = useRef(false);

  function mergeSessions(prev: AgentSession[], fetched: AgentSession[]): AgentSession[] {
    const map = new Map(prev.map(s => [s.id, s]));
    let changed = false;
    for (const s of fetched) {
      const existing = map.get(s.id);
      // Add new sessions or update ones with a newer updated_at
      if (!existing || existing.updated_at < s.updated_at) {
        map.set(s.id, s);
        changed = true;
      }
    }
    // Remove sessions that are no longer waiting/active
    const fetchedIds = new Set(fetched.map(s => s.id));
    for (const id of map.keys()) {
      if (!fetchedIds.has(id)) {
        map.delete(id);
        changed = true;
      }
    }
    if (!changed) return prev;
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  async function fetchSessions(isInitial = false) {
    // Show all waiting sessions (any agent can accept) but only active sessions
    // assigned to this agent — prevents other agents from seeing or interfering
    // with chats another agent has already accepted.
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id, visitor_name, visitor_email, status, agent_id, created_at, updated_at")
      .or(`status.eq.waiting,and(status.eq.active,agent_id.eq.${agentId})`)
      .order("updated_at", { ascending: false });

    if (error) { console.error("[useAgentSessions] fetch error:", error); return; }
    const fetched = (data as AgentSession[]) ?? [];

    if (isInitial) {
      setSessions(fetched);
      setLoading(false);
    } else {
      setSessions(prev => mergeSessions(prev, fetched));
    }
  }

  async function fetchLastMessages() {
    // Pull the most recent non-agent message per active/waiting session for preview + unread
    const { data } = await supabase
      .from("chat_messages")
      .select("session_id, sender_type, content, created_at")
      .neq("sender_type", "agent")
      .order("created_at", { ascending: false });

    if (!data) return;

    const seen = new Set<string>();
    for (const msg of data) {
      if (seen.has(msg.session_id)) continue;
      seen.add(msg.session_id);
      setLastMsgMap(prev => {
        if (prev[msg.session_id] === msg.content) return prev;
        return { ...prev, [msg.session_id]: msg.content };
      });
    }
  }

  useEffect(() => {
    if (!agentId) return;

    setLoading(true);
    fetchSessions(true);
    fetchLastMessages();

    // Realtime — session changes (primary path)
    const sessionCh = supabase
      .channel("agent:sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions" },
        payload => {
          realtimeOkRef.current = true;
          if (payload.eventType === "INSERT") {
            const s = payload.new as AgentSession;
            if (["waiting", "active"].includes(s.status)) {
              setSessions(prev => prev.some(x => x.id === s.id) ? prev : [s, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            const s = payload.new as AgentSession;
            setSessions(prev => {
              if (!["waiting", "active"].includes(s.status)) return prev.filter(x => x.id !== s.id);
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
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") realtimeOkRef.current = true;
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          realtimeOkRef.current = false;
          if (err) console.warn("[useAgentSessions] realtime unavailable, using polling:", status);
        }
      });

    // Realtime — message inserts (unread + preview)
    const msgCh = supabase
      .channel("agent:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        payload => {
          realtimeOkRef.current = true;
          const msg = payload.new as { session_id: string; sender_type: string; content: string };
          if (msg.sender_type !== "agent") {
            setLastMsgMap(prev => ({ ...prev, [msg.session_id]: msg.content }));
          }
          if (msg.sender_type !== "agent" && msg.session_id !== activeRef.current) {
            setUnreadMap(prev => ({
              ...prev,
              [msg.session_id]: (prev[msg.session_id] ?? 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    // Polling fallback — only runs when realtime is down
    const poll = setInterval(() => {
      if (!realtimeOkRef.current) {
        fetchSessions();
        fetchLastMessages();
      }
    }, POLL_INTERVAL);

    return () => {
      supabase.removeChannel(sessionCh);
      supabase.removeChannel(msgCh);
      clearInterval(poll);
    };
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return { sessions, loading, unreadMap, lastMsgMap, markViewed, acceptChat, closeChat };
}
