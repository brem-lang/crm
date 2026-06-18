-- Anonymous visitors also need UPDATE on chat_sessions and chat_queue
-- to transition their session to "waiting" and manage queue position.

GRANT UPDATE          ON public.chat_sessions TO anon;
GRANT UPDATE, DELETE  ON public.chat_queue    TO anon;
