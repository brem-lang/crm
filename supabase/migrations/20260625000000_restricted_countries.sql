ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS restricted_countries TEXT[] DEFAULT '{}';
