import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SessionStatus = "bot" | "waiting" | "active" | "closed" | null;

export interface HandoffState {
  sessionStatus: SessionStatus;
  queuePosition: number | null;
  isWaiting: boolean;
  isActive: boolean;
  isClosed: boolean;
}

const POLL_INTERVAL = 3000;

export function useChatHandoff(sessionId: string | null): HandoffState {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const realtimeOkRef = useRef(false);

  async function fetchStatus(sid: string) {
    const [sessionRes, queueRes] = await Promise.all([
      supabase.from("chat_sessions").select("status").eq("id", sid).single(),
      supabase.from("chat_queue").select("position").eq("session_id", sid).maybeSingle(),
    ]);
    if (sessionRes.data) setSessionStatus(sessionRes.data.status as SessionStatus);
    if (queueRes.data) setQueuePosition(queueRes.data.position);
    else if (sessionRes.data?.status !== "waiting") setQueuePosition(null);
  }

  useEffect(() => {
    if (!sessionId) {
      setSessionStatus(null);
      setQueuePosition(null);
      realtimeOkRef.current = false;
      return;
    }

    fetchStatus(sessionId);

    const sessionCh = supabase
      .channel(`handoff:session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_sessions" },
        payload => {
          const updated = payload.new as { id?: string; status: string };
          if (updated.id !== sessionId) return;
          realtimeOkRef.current = true;
          setSessionStatus(updated.status as SessionStatus);
          if (updated.status !== "waiting") setQueuePosition(null);
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") realtimeOkRef.current = true;
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          realtimeOkRef.current = false;
          if (err) console.warn("[useChatHandoff] realtime unavailable, using polling");
        }
      });

    const queueCh = supabase
      .channel(`handoff:queue:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_queue" },
        payload => {
          const row = (payload.new ?? payload.old) as { session_id?: string; position?: number };
          if (row.session_id !== sessionId) return;
          realtimeOkRef.current = true;
          if (payload.eventType === "DELETE") setQueuePosition(null);
          else setQueuePosition((payload.new as { position: number }).position);
        }
      )
      .subscribe();

    // Polling fallback — only runs when realtime is down
    const poll = setInterval(() => {
      if (!realtimeOkRef.current) fetchStatus(sessionId);
    }, POLL_INTERVAL);

    return () => {
      supabase.removeChannel(sessionCh);
      supabase.removeChannel(queueCh);
      clearInterval(poll);
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sessionStatus,
    queuePosition,
    isWaiting: sessionStatus === "waiting",
    isActive: sessionStatus === "active",
    isClosed: sessionStatus === "closed",
  };
}
