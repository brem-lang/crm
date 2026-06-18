import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SessionStatus = "bot" | "waiting" | "active" | "closed" | null;

export interface HandoffState {
  sessionStatus: SessionStatus;
  queuePosition: number | null;
  isWaiting: boolean;
  isActive: boolean;
  isClosed: boolean;
}

export function useChatHandoff(sessionId: string | null): HandoffState {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSessionStatus(null);
      setQueuePosition(null);
      return;
    }

    // Load current state on mount / session change
    Promise.all([
      supabase
        .from("chat_sessions")
        .select("status")
        .eq("id", sessionId)
        .single(),
      supabase
        .from("chat_queue")
        .select("position")
        .eq("session_id", sessionId)
        .maybeSingle(),
    ]).then(([sessionRes, queueRes]) => {
      if (sessionRes.data) setSessionStatus(sessionRes.data.status as SessionStatus);
      if (queueRes.data) setQueuePosition(queueRes.data.position);
    });

    // No server-side filters: filtered postgres_changes subscriptions stay
    // "pending" when the role lacks SELECT privilege. Filter client-side instead.
    const sessionCh = supabase
      .channel(`handoff:session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_sessions" },
        payload => {
          const updated = payload.new as { id?: string; status: string };
          if (updated.id !== sessionId) return;
          setSessionStatus(updated.status as SessionStatus);
          if (updated.status !== "waiting") setQueuePosition(null);
        }
      )
      .subscribe();

    const queueCh = supabase
      .channel(`handoff:queue:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_queue" },
        payload => {
          const row = (payload.new ?? payload.old) as { session_id?: string; position?: number };
          if (row.session_id !== sessionId) return;
          if (payload.eventType === "DELETE") {
            setQueuePosition(null);
          } else {
            setQueuePosition((payload.new as { position: number }).position);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionCh);
      supabase.removeChannel(queueCh);
    };
  }, [sessionId]);

  return {
    sessionStatus,
    queuePosition,
    isWaiting: sessionStatus === "waiting",
    isActive: sessionStatus === "active",
    isClosed: sessionStatus === "closed",
  };
}
