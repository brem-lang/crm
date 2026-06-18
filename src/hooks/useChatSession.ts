import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "chat_session_id";

export function useChatSession() {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_KEY)
  );
  const [creating, setCreating] = useState(false);

  async function createSession(visitorName?: string, visitorEmail?: string): Promise<string> {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ status: "bot", visitor_name: visitorName ?? null, visitor_email: visitorEmail ?? null })
        .select("id")
        .single();

      if (error) throw error;

      localStorage.setItem(SESSION_KEY, data.id);
      setSessionId(data.id);
      return data.id;
    } finally {
      setCreating(false);
    }
  }

  async function updateVisitorInfo(id: string, name: string, email: string) {
    await supabase
      .from("chat_sessions")
      .update({ visitor_name: name, visitor_email: email })
      .eq("id", id);
  }

  async function markWaiting(id: string) {
    await supabase
      .from("chat_sessions")
      .update({ status: "waiting" })
      .eq("id", id);
  }

  async function addToQueue(id: string): Promise<number> {
    // Get next available position (max + 1)
    const { data: top } = await supabase
      .from("chat_queue")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (top?.position ?? 0) + 1;

    await supabase
      .from("chat_queue")
      .insert({ session_id: id, position });

    return position;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
  }

  return { sessionId, createSession, updateVisitorInfo, markWaiting, addToQueue, clearSession, creating };
}
