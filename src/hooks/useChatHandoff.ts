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

    // Realtime: session status changes
    const sessionCh = supabase
      .channel(`handoff:session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_sessions",
          filter: `id=eq.${sessionId}`,
        },
        payload => {
          const updated = payload.new as { status: string };
          setSessionStatus(updated.status as SessionStatus);
          // Queue position is irrelevant once we leave waiting state
          if (updated.status !== "waiting") setQueuePosition(null);
        }
      )
      .subscribe();

    // Realtime: queue position updates (other sessions accepted ahead of us)
    const queueCh = supabase
      .channel(`handoff:queue:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_queue",
          filter: `session_id=eq.${sessionId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            setQueuePosition(null);
          } else {
            const q = payload.new as { position: number };
            setQueuePosition(q.position);
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
