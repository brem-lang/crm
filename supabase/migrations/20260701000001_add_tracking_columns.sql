-- Add affiliate tracking + submission UA columns to leads table

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS locale       TEXT,
  ADD COLUMN IF NOT EXISTS click_id     TEXT,
  ADD COLUMN IF NOT EXISTS submission_ua TEXT;

-- Index click_id for fraud detection queries (same click_id used multiple times)
CREATE INDEX IF NOT EXISTS idx_leads_click_id ON public.leads (click_id) WHERE click_id IS NOT NULL;
