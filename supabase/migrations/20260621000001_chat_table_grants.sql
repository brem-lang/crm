-- Explicit table grants for chat tables.
-- PostgreSQL checks privileges BEFORE RLS policies, so without these grants
-- the anon/authenticated roles cannot touch the tables even if RLS allows it.

-- anon: can create sessions, insert messages, read own session/messages
GRANT SELECT, INSERT        ON public.chat_sessions TO anon;
GRANT SELECT, INSERT        ON public.chat_messages TO anon;
GRANT SELECT, INSERT        ON public.chat_queue    TO anon;
GRANT SELECT                ON public.chat_agents   TO anon;

-- authenticated: full access needed by agents, managers, admins
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_queue    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_agents   TO authenticated;
