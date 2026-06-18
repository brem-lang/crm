import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMsg {
  id: string;
  sender_type: "bot" | "user" | "agent";
  content: string;
  created_at: string;
  sender_id: string | null;
}

const POLL_INTERVAL = 3000;

export function useChatMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const prevSessionIdRef = useRef<string | null>(null);
  const realtimeOkRef = useRef(false);
  const lastFetchedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      prevSessionIdRef.current = null;
      realtimeOkRef.current = false;
      lastFetchedAtRef.current = null;
      return;
    }

    if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== sessionId) {
      setMessages([]);
      realtimeOkRef.current = false;
      lastFetchedAtRef.current = null;
    }
    prevSessionIdRef.current = sessionId;

    // Full fetch on initial load — establish baseline and cursor
    async function fetchAll() {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, sender_type, content, created_at, sender_id")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useChatMessages] fetch error:", error);
        setLoading(false);
        return;
      }

      const fetched = (data as ChatMsg[]) ?? [];
      setMessages(fetched);
      if (fetched.length > 0) {
        lastFetchedAtRef.current = fetched[fetched.length - 1].created_at;
      }
      setLoading(false);
    }

    // Incremental fetch — only rows newer than cursor, used by polling fallback
    async function fetchIncremental() {
      const since = lastFetchedAtRef.current;
      let q = supabase
        .from("chat_messages")
        .select("id, sender_type, content, created_at, sender_id")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });

      if (since) q = q.gt("created_at", since);

      const { data, error } = await q;
      if (error || !data || data.length === 0) return;

      const fresh = data as ChatMsg[];
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = fresh.filter(m => !existingIds.has(m.id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs];
      });
      lastFetchedAtRef.current = fresh[fresh.length - 1].created_at;
    }

    fetchAll();

    const channel = supabase
      .channel(`chat_messages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        payload => {
          const incoming = payload.new as ChatMsg & { session_id?: string };
          if (incoming.session_id !== sessionId) return;
          realtimeOkRef.current = true;
          lastFetchedAtRef.current = incoming.created_at;
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

    const poll = setInterval(() => {
      if (!realtimeOkRef.current) fetchIncremental();
    }, POLL_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [sessionId]);

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
      sender_id: senderId ?? null,
    };
    setMessages(prev => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ session_id: sid, sender_type: senderType, content, sender_id: senderId ?? null })
      .select("id, sender_type, content, created_at, sender_id")
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
