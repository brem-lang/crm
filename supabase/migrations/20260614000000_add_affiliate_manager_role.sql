-- Create user_affiliate_assignments table
-- Links which affiliates an affiliate_manager user is allowed to see/manage
CREATE TABLE IF NOT EXISTS public.user_affiliate_assignments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, affiliate_id)
);

-- RLS
ALTER TABLE public.user_affiliate_assignments ENABLE ROW LEVEL SECURITY;

-- Users can read their own assignments; super admins can read all
CREATE POLICY "uaa_select"
  ON public.user_affiliate_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- Only super admins can assign affiliates to users
CREATE POLICY "uaa_insert_super_admin"
  ON public.user_affiliate_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "uaa_delete_super_admin"
  ON public.user_affiliate_assignments FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Seed the affiliate_manager custom role
INSERT INTO public.roles (name, slug, description, color, is_system)
VALUES ('Affiliate Manager', 'affiliate_manager', 'Manages specific affiliates and views their leads only', 'orange', false)
ON CONFLICT (slug) DO NOTHING;
