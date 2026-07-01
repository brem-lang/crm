-- In-app admin notifications (e.g. test lead rejections)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_created_at_idx ON public.notifications (created_at DESC);
CREATE INDEX notifications_is_read_idx ON public.notifications (is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "notifications_update_admin" ON public.notifications
  FOR UPDATE USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
