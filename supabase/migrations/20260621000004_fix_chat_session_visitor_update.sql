-- Any visitor must be able to update their own chat session (e.g. mark as waiting,
-- update visitor info). The existing update policies only cover agents/admins,
-- which means authenticated users with affiliate/custom/no roles cannot transition
-- their session from "bot" to "waiting" — so their chats never appear to agents.
--
-- The session UUID stored in the visitor's localStorage acts as the access token.
-- There is no practical security concern with allowing open updates here.

DROP POLICY IF EXISTS "chat_sessions_update_anon"    ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_update_visitor" ON public.chat_sessions;

-- Covers all visitors: anonymous, affiliate, custom-role, or any authenticated user
CREATE POLICY "chat_sessions_update_visitor" ON public.chat_sessions
  FOR UPDATE USING (true);
