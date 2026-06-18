-- Allow anonymous visitors to update their own chat session (e.g. mark as waiting)
-- and manage their queue position. Without UPDATE on chat_sessions, markWaiting()
-- silently fails and the session never transitions from "bot" to "waiting",
-- so it never appears in the agent dashboard.

GRANT UPDATE ON public.chat_sessions TO anon;
GRANT UPDATE, DELETE ON public.chat_queue TO anon;
