-- Global Leads page column order, set by super_admin, shared with all roles
ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS leads_column_order TEXT[] NOT NULL DEFAULT '{}';
