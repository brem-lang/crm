-- Ensure all chat table INSERT policies exist and are permissive for all roles.
-- Drops and recreates to be idempotent — safe to run multiple times.

-- ── chat_sessions ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_sessions_insert_anon" ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_insert_all"  ON public.chat_sessions;

-- Any visitor (anon or authenticated) can open a new chat session.
CREATE POLICY "chat_sessions_insert_all" ON public.chat_sessions
  FOR INSERT WITH CHECK (true);

-- ── chat_messages ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_messages_insert_anon" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert_all"  ON public.chat_messages;

CREATE POLICY "chat_messages_insert_all" ON public.chat_messages
  FOR INSERT WITH CHECK (true);

-- ── chat_queue ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_queue_insert_anon" ON public.chat_queue;
DROP POLICY IF EXISTS "chat_queue_insert_all"  ON public.chat_queue;

CREATE POLICY "chat_queue_insert_all" ON public.chat_queue
  FOR INSERT WITH CHECK (true);

-- ── chat_agents ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_agents_insert_self" ON public.chat_agents;

-- Agents create their own row on first login.
CREATE POLICY "chat_agents_insert_self" ON public.chat_agents
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── SELECT: anon visitors must be able to read their own session ──────────────

DROP POLICY IF EXISTS "chat_sessions_select_anon_by_id" ON public.chat_sessions;

CREATE POLICY "chat_sessions_select_anon_by_id" ON public.chat_sessions
  FOR SELECT USING (true);
