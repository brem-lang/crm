import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMsg {
  id: string;
  sender_type: "bot" | "user" | "agent";
  content: string;
  created_at: string;
}

export function useChatMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    supabase
      .from("chat_messages")
      .select("id, sender_type, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const fetched = (data as ChatMsg[]) ?? [];
        setMessages(prev => {
          // No existing messages — just use DB result (returning user / page reload)
          if (prev.length === 0) return fetched;
          // Existing optimistic/confirmed messages — merge: add any from DB not already present
          const prevIds = new Set(prev.map(m => m.id));
          const newFromDb = fetched.filter(m => !prevIds.has(m.id));
          if (newFromDb.length === 0) return prev;
          return [...prev, ...newFromDb].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
        setLoading(false);
      });

    const channel = supabase
      .channel(`chat_messages:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        payload => {
          const incoming = payload.new as ChatMsg;
          setMessages(prev =>
            prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    };
    // Optimistic update — show immediately
    setMessages(prev => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ session_id: sid, sender_type: senderType, content, sender_id: senderId ?? null })
      .select("id, sender_type, content, created_at")
      .single();

    if (error) {
      // Roll back optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      throw error;
    }

    const confirmed = data as ChatMsg;
    // Replace optimistic entry with confirmed one (dedup realtime event too)
    setMessages(prev =>
      prev
        .filter(m => m.id !== optimisticId)
        .concat(prev.some(m => m.id === confirmed.id) ? [] : [confirmed])
    );
    return confirmed;
  }

  return { messages, loading, insertMessage };
}
