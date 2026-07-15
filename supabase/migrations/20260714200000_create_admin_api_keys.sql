CREATE TABLE public.admin_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_api_keys_super_admin_all" ON public.admin_api_keys
  FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

INSERT INTO public.admin_api_keys (name) VALUES ('Get All Leads API key');
