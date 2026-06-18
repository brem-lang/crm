import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export interface ChatSessionRow {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: string;
  agent_id: string | null;
  created_at: string;
  closed_at: string | null;
  transcript_text: string | null;
  updated_at: string;
}

export interface ChatSessionStats {
  total: number;
  waiting: number;
  active: number;
  closedToday: number;
}

interface Filters {
  status?: string;
  visitorSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useChatSessionsList(filters: Filters = {}) {
  const { status, visitorSearch, dateFrom, dateTo, page = 1, pageSize = 50 } = filters;

  return useQuery({
    queryKey: ["chat-sessions-list", status, visitorSearch, dateFrom, dateTo, page, pageSize],
    staleTime: 30 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("chat_sessions")
        .select(
          "id, visitor_name, visitor_email, status, agent_id, created_at, closed_at, transcript_text, updated_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (status && status !== "all") query = query.eq("status", status);
      if (visitorSearch) {
        query = query.or(
          `visitor_name.ilike.%${visitorSearch}%,visitor_email.ilike.%${visitorSearch}%`
        );
      }
      if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo)
        query = query.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        sessions: (data as ChatSessionRow[]) ?? [],
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      };
    },
  });
}

export function useChatSessionStats() {
  return useQuery({
    queryKey: ["chat-session-stats"],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ChatSessionStats> => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [totalRes, waitingRes, activeRes, closedTodayRes] = await Promise.all([
        supabase.from("chat_sessions").select("*", { count: "exact", head: true }),
        supabase
          .from("chat_sessions")
          .select("*", { count: "exact", head: true })
          .eq("status", "waiting"),
        supabase
          .from("chat_sessions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("chat_sessions")
          .select("*", { count: "exact", head: true })
          .eq("status", "closed")
          .gte("closed_at", todayStart.toISOString()),
      ]);

      return {
        total: totalRes.count ?? 0,
        waiting: waitingRes.count ?? 0,
        active: activeRes.count ?? 0,
        closedToday: closedTodayRes.count ?? 0,
      };
    },
  });
}

// Realtime invalidation — mount once on the ChatSessions page
export function useChatSessionsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("admin:chat_sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-sessions-list"] });
          queryClient.invalidateQueries({ queryKey: ["chat-session-stats"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}
