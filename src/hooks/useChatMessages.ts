import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMsg {
  id: string;
  sender_type: "bot" | "user" | "agent";
  content: string;
  created_at: string;
}

const POLL_INTERVAL = 3000;

export function useChatMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const prevSessionIdRef = useRef<string | null>(null);
  // Track whether realtime is working so polling only runs as a fallback
  const realtimeOkRef = useRef(false);

  function mergeMessages(prev: ChatMsg[], fetched: ChatMsg[]): ChatMsg[] {
    if (prev.length === 0) return fetched;
    const prevIds = new Set(prev.map(m => m.id));
    const fresh = fetched.filter(m => !prevIds.has(m.id));
    if (fresh.length === 0) return prev;
    return [...prev, ...fresh].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  async function fetchMessages(sid: string, isInitial = false) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_type, content, created_at")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[useChatMessages] fetch error:", error);
      if (isInitial) setLoading(false);
      return;
    }

    const fetched = (data as ChatMsg[]) ?? [];
    setMessages(prev => isInitial && prev.length === 0 ? fetched : mergeMessages(prev, fetched));
    if (isInitial) setLoading(false);
  }

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      prevSessionIdRef.current = null;
      realtimeOkRef.current = false;
      return;
    }

    if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== sessionId) {
      setMessages([]);
      realtimeOkRef.current = false;
    }
    prevSessionIdRef.current = sessionId;

    setLoading(true);
    fetchMessages(sessionId, true);

    // Realtime — primary path
    const channel = supabase
      .channel(`chat_messages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        payload => {
          const incoming = payload.new as ChatMsg & { session_id?: string };
          if (incoming.session_id !== sessionId) return;
          realtimeOkRef.current = true;
          setMessages(prev =>
            prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]
          );
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          realtimeOkRef.current = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          realtimeOkRef.current = false;
          if (err) console.warn("[useChatMessages] realtime unavailable, using polling:", status);
        }
      });

    // Polling fallback — runs every 3 s; skipped when realtime confirmed working
    const poll = setInterval(() => {
      if (!realtimeOkRef.current) fetchMessages(sessionId);
    }, POLL_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function insertMessage(
    sid: string,
    senderType: "bot" | "user" | "agent",
    content: string,
    senderId?: string
  ): Promise<ChatMsg> {
    const optimisticId = `opt_${Date.now()}_${Math.random()}`;
    const optimistic: ChatMsg = {
      id: optimisticId,
      sender_type: senderType,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ session_id: sid, sender_type: senderType, content, sender_id: senderId ?? null })
      .select("id, sender_type, content, created_at")
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      throw error;
    }

    const confirmed = data as ChatMsg;
    setMessages(prev =>
      prev
        .filter(m => m.id !== optimisticId)
        .concat(prev.some(m => m.id === confirmed.id) ? [] : [confirmed])
    );
    return confirmed;
  }

  return { messages, loading, insertMessage };
}
