-- Add request tracking fields to lead_distributions
ALTER TABLE public.lead_distributions
  ADD COLUMN IF NOT EXISTS request_url TEXT,
  ADD COLUMN IF NOT EXISTS request_headers JSONB,
  ADD COLUMN IF NOT EXISTS request_payload TEXT;
