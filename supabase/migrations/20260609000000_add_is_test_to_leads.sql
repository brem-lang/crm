ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_leads_is_test ON public.leads(is_test);
