-- Chat Support System: tables, RLS, indexes, realtime, helper functions

-- ── 1. chat_agents ────────────────────────────────────────────────────────────
-- One row per CRM user who can act as a support agent.
-- Linked to auth.users so existing agent-role accounts are used directly.
CREATE TABLE IF NOT EXISTS public.chat_agents (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online  boolean     NOT NULL DEFAULT false,
  max_chats  integer     NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ── 2. chat_sessions ─────────────────────────────────────────────────────────
-- One row per visitor conversation.
-- status flow: bot → waiting → active → closed
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name    text,
  visitor_email   text,
  status          text        NOT NULL DEFAULT 'bot'
                              CHECK (status IN ('bot', 'waiting', 'active', 'closed')),
  agent_id        uuid        REFERENCES public.chat_agents(id) ON DELETE SET NULL,
  queue_position  integer,
  transcript_text text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 3. chat_messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender_type text        NOT NULL CHECK (sender_type IN ('bot', 'user', 'agent')),
  sender_id   uuid,       -- null for anonymous user or bot
  content     text        NOT NULL,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. chat_queue ─────────────────────────────────────────────────────────────
-- Visitors waiting for a live agent when all are busy.
CREATE TABLE IF NOT EXISTS public.chat_queue (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  position   integer     NOT NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status       ON public.chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id     ON public.chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at   ON public.chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id   ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at   ON public.chat_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_queue_position        ON public.chat_queue(position ASC);
CREATE INDEX IF NOT EXISTS idx_chat_agents_user_id        ON public.chat_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_agents_is_online      ON public.chat_agents(is_online) WHERE is_online = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_agents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_queue    ENABLE ROW LEVEL SECURITY;

-- chat_agents
CREATE POLICY "chat_agents_select_authenticated" ON public.chat_agents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "chat_agents_insert_self" ON public.chat_agents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_agents_update_self_or_super_admin" ON public.chat_agents
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "chat_agents_delete_super_admin" ON public.chat_agents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- chat_sessions
-- Visitors identify by their session_id stored in localStorage (anon select by id).
-- Agents see sessions assigned to them; super_admin/manager see all.
CREATE POLICY "chat_sessions_select_agent_or_admin" ON public.chat_sessions
  FOR SELECT USING (
    -- Authenticated agents: see own assigned sessions or all if super_admin/manager
    auth.uid() IS NOT NULL
    AND (
      agent_id IN (SELECT id FROM public.chat_agents WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager')
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'agent'
      )
    )
  );

CREATE POLICY "chat_sessions_select_anon_by_id" ON public.chat_sessions
  FOR SELECT USING (auth.uid() IS NULL);

CREATE POLICY "chat_sessions_insert_anon" ON public.chat_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "chat_sessions_update_agent_or_admin" ON public.chat_sessions
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      agent_id IN (SELECT id FROM public.chat_agents WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
      )
    )
  );

CREATE POLICY "chat_sessions_update_anon" ON public.chat_sessions
  FOR UPDATE USING (auth.uid() IS NULL);

-- chat_messages
CREATE POLICY "chat_messages_select_all" ON public.chat_messages
  FOR SELECT USING (true);

CREATE POLICY "chat_messages_insert_all" ON public.chat_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "chat_messages_update_agent_or_admin" ON public.chat_messages
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
    )
  );

-- chat_queue
CREATE POLICY "chat_queue_select_all" ON public.chat_queue
  FOR SELECT USING (true);

CREATE POLICY "chat_queue_insert_all" ON public.chat_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "chat_queue_update_agent_or_admin" ON public.chat_queue
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
    )
  );

CREATE POLICY "chat_queue_delete_agent_or_admin" ON public.chat_queue
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
    )
  );

-- ── Helper functions ──────────────────────────────────────────────────────────

-- Accepts a chat: sets session to active, assigns agent, removes from queue
CREATE OR REPLACE FUNCTION public.accept_chat(
  _session_id uuid,
  _agent_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  SELECT id INTO v_agent_id FROM public.chat_agents WHERE user_id = _agent_user_id;
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'No chat_agents row for user %', _agent_user_id;
  END IF;

  UPDATE public.chat_sessions
    SET status   = 'active',
        agent_id = v_agent_id
    WHERE id = _session_id AND status = 'waiting';

  DELETE FROM public.chat_queue WHERE session_id = _session_id;

  -- Reorder remaining queue positions
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY joined_at ASC) AS new_pos
    FROM public.chat_queue
  )
  UPDATE public.chat_queue q
    SET position = r.new_pos
    FROM ranked r
    WHERE q.id = r.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_chat(uuid, uuid) TO authenticated;

-- Closes a chat and saves a plain-text transcript
CREATE OR REPLACE FUNCTION public.close_chat(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transcript text;
BEGIN
  SELECT string_agg(
    '[' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || '] '
    || upper(sender_type) || ': ' || content,
    E'\n'
    ORDER BY created_at ASC
  )
  INTO v_transcript
  FROM public.chat_messages
  WHERE session_id = _session_id;

  UPDATE public.chat_sessions
    SET status          = 'closed',
        closed_at       = now(),
        transcript_text = v_transcript
    WHERE id = _session_id;

  DELETE FROM public.chat_queue WHERE session_id = _session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_chat(uuid) TO authenticated;
-- Allow anon visitors to close their own session (e.g. window close)
GRANT EXECUTE ON FUNCTION public.close_chat(uuid) TO anon;

-- ── Realtime ──────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_queue;
