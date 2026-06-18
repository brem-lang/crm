-- Add the chat_support role and update chat table RLS to recognise it.
-- This role lives in the `roles` table (is_system = true) and is assigned
-- via user_custom_roles, because the app_role enum is locked.

-- ── 1. Seed the role ──────────────────────────────────────────────────────────
INSERT INTO public.roles (name, slug, description, color, is_system)
VALUES (
  'Chat Support',
  'chat_support',
  'Dedicated support agent — access to chat support features only',
  'teal',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Helper function ────────────────────────────────────────────────────────
-- Used inside RLS policies to avoid repeating the join.
CREATE OR REPLACE FUNCTION public.is_chat_support(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = uid
      AND r.slug = 'chat_support'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_support(uuid) TO authenticated;

-- ── 3. Update chat_sessions SELECT policy ────────────────────────────────────
DROP POLICY IF EXISTS "chat_sessions_select_agent_or_admin" ON public.chat_sessions;

CREATE POLICY "chat_sessions_select_agent_or_admin" ON public.chat_sessions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      agent_id IN (SELECT id FROM public.chat_agents WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
      )
      OR public.is_chat_support(auth.uid())
    )
  );

-- ── 4. Update chat_sessions UPDATE policy ────────────────────────────────────
DROP POLICY IF EXISTS "chat_sessions_update_agent_or_admin" ON public.chat_sessions;

CREATE POLICY "chat_sessions_update_agent_or_admin" ON public.chat_sessions
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      agent_id IN (SELECT id FROM public.chat_agents WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
      )
      OR public.is_chat_support(auth.uid())
    )
  );

-- ── 5. Update chat_messages UPDATE policy ────────────────────────────────────
DROP POLICY IF EXISTS "chat_messages_update_agent_or_admin" ON public.chat_messages;

CREATE POLICY "chat_messages_update_agent_or_admin" ON public.chat_messages
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
      )
      OR public.is_chat_support(auth.uid())
    )
  );

-- ── 6. Update chat_queue UPDATE policy ───────────────────────────────────────
DROP POLICY IF EXISTS "chat_queue_update_agent_or_admin" ON public.chat_queue;

CREATE POLICY "chat_queue_update_agent_or_admin" ON public.chat_queue
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
      )
      OR public.is_chat_support(auth.uid())
    )
  );

-- ── 7. Update chat_queue DELETE policy ───────────────────────────────────────
DROP POLICY IF EXISTS "chat_queue_delete_agent_or_admin" ON public.chat_queue;

CREATE POLICY "chat_queue_delete_agent_or_admin" ON public.chat_queue
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('super_admin', 'manager', 'agent')
      )
      OR public.is_chat_support(auth.uid())
    )
  );
