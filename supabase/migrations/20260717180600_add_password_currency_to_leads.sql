ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS currency text;
