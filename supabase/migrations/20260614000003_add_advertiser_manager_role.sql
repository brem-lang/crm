-- Create user_advertiser_assignments table
-- Links which advertisers an advertiser_manager user is allowed to see
CREATE TABLE IF NOT EXISTS public.user_advertiser_assignments (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, advertiser_id)
);

ALTER TABLE public.user_advertiser_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uadv_select"
  ON public.user_advertiser_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "uadv_insert_super_admin"
  ON public.user_advertiser_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "uadv_delete_super_admin"
  ON public.user_advertiser_assignments FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Seed the advertiser_manager custom role
INSERT INTO public.roles (name, slug, description, color, is_system)
VALUES ('Advertiser Manager', 'advertiser_manager', 'Manages specific advertisers and views their leads only', 'blue', false)
ON CONFLICT (slug) DO NOTHING;
