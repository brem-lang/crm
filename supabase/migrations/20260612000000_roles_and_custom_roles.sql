-- Roles table: stores both system and custom role definitions
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'gray',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the 4 system roles
INSERT INTO public.roles (name, slug, description, color, is_system) VALUES
  ('Super Admin', 'super_admin', 'Full access to all features and settings', 'red', true),
  ('Manager', 'manager', 'Manage leads, affiliates, advertisers, and reports', 'blue', true),
  ('Agent', 'agent', 'Work with leads and view reports', 'green', true),
  ('Affiliate', 'affiliate', 'External partner with limited lead access', 'purple', true)
ON CONFLICT (slug) DO NOTHING;

-- Role-permission mappings: links a role slug to a permission key
CREATE TABLE IF NOT EXISTS public.role_permission_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slug text NOT NULL,
  permission_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_slug, permission_key)
);

-- Seed default permissions for system roles
-- super_admin gets all permissions
INSERT INTO public.role_permission_mappings (role_slug, permission_key) VALUES
  ('super_admin', 'view_phone'),
  ('super_admin', 'view_email'),
  ('super_admin', 'view_all_leads'),
  ('super_admin', 'edit_leads'),
  ('super_admin', 'delete_leads'),
  ('super_admin', 'export_leads'),
  ('super_admin', 'resend_leads'),
  ('super_admin', 'add_leads_to_test'),
  ('super_admin', 'create_advertisers'),
  ('super_admin', 'edit_advertisers'),
  ('super_admin', 'delete_advertisers'),
  ('super_admin', 'edit_advertiser_config'),
  ('super_admin', 'create_affiliates'),
  ('super_admin', 'edit_affiliates'),
  ('super_admin', 'delete_affiliates'),
  ('super_admin', 'create_injection_pools'),
  ('super_admin', 'delete_injection_pools'),
  ('super_admin', 'create_injection_jobs'),
  ('super_admin', 'delete_injection_jobs'),
  ('super_admin', 'export_injection_leads'),
  ('super_admin', 'delete_injection_leads'),
  ('super_admin', 'create_lead_pools'),
  ('super_admin', 'delete_lead_pools'),
  ('super_admin', 'delete_distributions'),
  ('super_admin', 'create_distribution_rules'),
  ('super_admin', 'edit_distribution_rules'),
  ('super_admin', 'delete_distribution_rules'),
  ('super_admin', 'release_conversions'),
  ('super_admin', 'delete_conversions'),
  ('super_admin', 'export_conversions'),
  ('super_admin', 'delete_rejected_leads'),
  ('super_admin', 'delete_affiliate_submissions'),
  ('super_admin', 'delete_test_leads'),
  ('super_admin', 'view_reports'),
  ('super_admin', 'view_audit_logs'),
  ('super_admin', 'view_monitoring')
ON CONFLICT (role_slug, permission_key) DO NOTHING;

-- manager: all except view_audit_logs, view_monitoring, delete_test_leads, delete_affiliate_submissions
INSERT INTO public.role_permission_mappings (role_slug, permission_key) VALUES
  ('manager', 'view_phone'),
  ('manager', 'view_email'),
  ('manager', 'view_all_leads'),
  ('manager', 'edit_leads'),
  ('manager', 'delete_leads'),
  ('manager', 'export_leads'),
  ('manager', 'resend_leads'),
  ('manager', 'add_leads_to_test'),
  ('manager', 'create_advertisers'),
  ('manager', 'edit_advertisers'),
  ('manager', 'delete_advertisers'),
  ('manager', 'edit_advertiser_config'),
  ('manager', 'create_affiliates'),
  ('manager', 'edit_affiliates'),
  ('manager', 'delete_affiliates'),
  ('manager', 'create_injection_pools'),
  ('manager', 'delete_injection_pools'),
  ('manager', 'create_injection_jobs'),
  ('manager', 'delete_injection_jobs'),
  ('manager', 'export_injection_leads'),
  ('manager', 'delete_injection_leads'),
  ('manager', 'create_lead_pools'),
  ('manager', 'delete_lead_pools'),
  ('manager', 'delete_distributions'),
  ('manager', 'create_distribution_rules'),
  ('manager', 'edit_distribution_rules'),
  ('manager', 'delete_distribution_rules'),
  ('manager', 'release_conversions'),
  ('manager', 'delete_conversions'),
  ('manager', 'export_conversions'),
  ('manager', 'delete_rejected_leads'),
  ('manager', 'view_reports')
ON CONFLICT (role_slug, permission_key) DO NOTHING;

-- agent: leads and reports only
INSERT INTO public.role_permission_mappings (role_slug, permission_key) VALUES
  ('agent', 'view_all_leads'),
  ('agent', 'view_phone'),
  ('agent', 'view_email'),
  ('agent', 'edit_leads'),
  ('agent', 'export_leads'),
  ('agent', 'resend_leads'),
  ('agent', 'add_leads_to_test'),
  ('agent', 'view_reports')
ON CONFLICT (role_slug, permission_key) DO NOTHING;

-- affiliate: minimal access
INSERT INTO public.role_permission_mappings (role_slug, permission_key) VALUES
  ('affiliate', 'view_all_leads')
ON CONFLICT (role_slug, permission_key) DO NOTHING;

-- User custom roles: assigns custom (non-system) roles to users
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- RLS for roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "roles_insert_super_admin"
  ON public.roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "roles_update_super_admin"
  ON public.roles FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "roles_delete_super_admin"
  ON public.roles FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()) AND is_system = false);

-- RLS for role_permission_mappings table
ALTER TABLE public.role_permission_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permission_mappings_select_authenticated"
  ON public.role_permission_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "role_permission_mappings_insert_super_admin"
  ON public.role_permission_mappings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "role_permission_mappings_delete_super_admin"
  ON public.role_permission_mappings FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- RLS for user_custom_roles table
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_custom_roles_select_own"
  ON public.user_custom_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "user_custom_roles_insert_super_admin"
  ON public.user_custom_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "user_custom_roles_delete_super_admin"
  ON public.user_custom_roles FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
